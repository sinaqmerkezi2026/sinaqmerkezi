"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Award, Share2, ArrowLeft, BrainCircuit, Loader2, Sparkles, Trophy } from 'lucide-react';
import { gradeExplanationQuestion } from '@/ai/flows/grade-explanation-question-flow';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function Results() {
  const { code } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [exam, setExam] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [aiFeedbacks, setAiFeedbacks] = useState<Record<string, { score: number, feedback: string }>>({});
  const [isGrading, setIsGrading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const cleanCode = code?.toString().trim().toUpperCase();
      if (!cleanCode) return;
      
      setIsLoading(true);
      try {
        const codeRef = doc(firestore, 'accessCodes', cleanCode);
        const codeSnap = await getDoc(codeRef);

        if (!codeSnap.exists()) {
          toast({ title: 'Xəta', description: 'Kod tapılmadı.', variant: 'destructive' });
          router.push('/');
          return;
        }

        const codeData = codeSnap.data();
        if (!codeData.studentAttemptId) {
          router.push('/');
          return;
        }

        const [examDoc, attemptDoc] = await Promise.all([
          getDoc(doc(firestore, 'exams', codeData.examId)),
          getDoc(doc(firestore, 'studentAttempts', codeData.studentAttemptId))
        ]);

        if (!examDoc.exists() || !attemptDoc.exists()) {
          router.push('/');
          return;
        }

        const examData = examDoc.data();
        const attemptData = attemptDoc.data();

        setExam(examData);
        setAttempt(attemptData);

        if (attemptData.results) {
          setAiFeedbacks(attemptData.results);
        } else {
          await gradeExplanations(examData, attemptData);
        }
      } catch (error) {
        console.error("Error fetching results:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [code, firestore, router, toast]);

  const gradeExplanations = async (e: any, a: any) => {
    setIsGrading(true);
    const feedbacks: Record<string, any> = {};
    
    const explanationQuestions = (e.questions || []).filter((q: any) => q.type === 'explanation');
    
    for (const q of explanationQuestions) {
      const studentAns = a.answers?.[q.id];
      if (studentAns?.explanation) {
        try {
          const result = await gradeExplanationQuestion({
            studentExplanation: studentAns.explanation,
            adminExplanationCriterion: q.explanationCriterion || q.correctAnswer
          });
          feedbacks[q.id] = result;
        } catch (err) {
          console.error(`Grading error for Q ${q.id}:`, err);
          feedbacks[q.id] = { score: 0, feedback: 'AI qiymətləndirmə zamanı xəta baş verdi.' };
        }
      } else {
        feedbacks[q.id] = { score: 0, feedback: 'İzah daxil edilməyib.' };
      }
    }
    
    setAiFeedbacks(feedbacks);
    
    try {
      const attemptRef = doc(firestore, 'studentAttempts', a.id);
      await updateDoc(attemptRef, { results: feedbacks });
    } catch (err) {
      console.error("Failed to save AI results:", err);
    }
    
    setIsGrading(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6">
          <Loader2 className="w-20 h-20 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-black text-2xl">Nəticələr hazırlanır...</p>
        </div>
      </div>
    );
  }

  if (!exam || !attempt) return null;

  const calculateTotalScore = () => {
    let earnedPoints = 0;
    const questions = exam.questions || [];
    
    questions.forEach((q: any) => {
      const ans = attempt.answers?.[q.id];
      if (!ans) return;

      const studentFinal = ans.finalAnswer?.trim().toLowerCase();
      const correctFinal = q.correctAnswer?.trim().toLowerCase();

      if (q.type === 'mcq' || q.type === 'open') {
        if (studentFinal === correctFinal) earnedPoints += 1;
      } else if (q.type === 'explanation') {
        const isFinalCorrect = studentFinal === correctFinal;
        const aiResult = aiFeedbacks[q.id];
        if (isFinalCorrect && aiResult) earnedPoints += aiResult.score;
      }
    });
    
    return questions.length > 0 ? (earnedPoints / questions.length) * 100 : 0;
  };

  const totalScore = calculateTotalScore();

  return (
    <div className="min-h-screen bg-background p-6 font-body">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => router.push('/')} className="rounded-xl font-bold hover:bg-muted shadow-sm border border-transparent">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Ana Səhifə
          </Button>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="outline" className="rounded-xl font-bold bg-card shadow-sm border-border/50">
              <Share2 className="w-5 h-5 mr-2" />
              Paylaş
            </Button>
          </div>
        </header>

        <Card className="border-none shadow-2xl bg-gradient-to-br from-primary via-primary/80 to-blue-900 text-white rounded-[3rem] overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12">
            <Trophy className="w-64 h-64 text-white" />
          </div>
          <CardContent className="relative z-10 py-20 flex flex-col items-center">
            <div className="bg-white/10 p-8 rounded-[2rem] backdrop-blur-md mb-8 shadow-2xl border border-white/20 animate-pulse">
              <Award className="w-20 h-20 text-white" />
            </div>
            <CardTitle className="text-5xl font-black mb-4 drop-shadow-md text-white">İmtahan Bitdi!</CardTitle>
            <CardDescription className="text-white/80 text-xl font-medium mb-10 max-w-lg text-center leading-relaxed">
              Təbriklər <span className="text-white font-black">{attempt.studentFirstName} {attempt.studentLastName}</span>, zəhmətiniz AI tərəfindən ballandırıldı.
            </CardDescription>
            
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="absolute -inset-4 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all"></div>
                <div className="relative text-[10rem] font-black leading-none flex items-start text-white">
                  {Math.round(totalScore)}
                  <span className="text-4xl font-bold mt-10 opacity-60">%</span>
                </div>
              </div>
              <div className="mt-4 text-sm uppercase tracking-[0.5em] font-black bg-white/10 px-8 py-2 rounded-full border border-white/20 text-white">
                Ümumi Göstərici
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-5 space-y-6">
            <h3 className="text-muted-foreground text-sm font-black uppercase tracking-[0.2em] px-2 flex items-center gap-3">
              <Sparkles className="w-4 h-4 text-primary" />
              Sual Analizi
            </h3>
            <div className="space-y-4">
              {(exam.questions || []).map((q: any, i: number) => {
                const ans = attempt.answers?.[q.id];
                const isCorrect = ans?.finalAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();
                return (
                  <Card key={q.id} className="border border-border/50 shadow-sm rounded-2xl overflow-hidden bg-card/50 hover:shadow-md transition-shadow">
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-5">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-sm",
                          isCorrect ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"
                        )}>
                          {i + 1}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-foreground font-bold text-lg">Sual {i + 1}</span>
                          <span className="text-xs text-muted-foreground font-bold uppercase tracking-wider">{q.type === 'explanation' ? 'AI İzahlı' : q.type === 'mcq' ? 'Qapalı' : 'Açıq'}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {q.type === 'explanation' ? (
                          <div className="flex items-center gap-3">
                            <span className="text-sm px-4 py-1.5 bg-primary/20 text-primary font-black rounded-xl">
                              AI: {aiFeedbacks[q.id]?.score !== undefined ? `${(aiFeedbacks[q.id].score * 100).toFixed(0)}%` : '...'}
                            </span>
                            {isCorrect ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <XCircle className="w-6 h-6 text-red-500" />}
                          </div>
                        ) : (
                          isCorrect ? <CheckCircle2 className="w-8 h-8 text-green-500" /> : <XCircle className="w-8 h-8 text-red-500" />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            <h3 className="text-muted-foreground text-sm font-black uppercase tracking-[0.2em] px-2 flex items-center gap-3">
              <BrainCircuit className="w-5 h-5 text-primary" />
              Süni İntellekt Rəyləri
            </h3>
            <div className="space-y-8">
              {isGrading ? (
                <div className="bg-card rounded-[3rem] p-20 flex flex-col items-center justify-center text-center space-y-6 shadow-sm border border-border/50">
                  <div className="relative">
                    <BrainCircuit className="w-20 h-20 animate-pulse text-primary/30" />
                    <Loader2 className="w-full h-full absolute inset-0 animate-spin text-primary opacity-20" />
                  </div>
                  <div className="space-y-2">
                    <p className="text-2xl font-black text-foreground">Analiz aparılır...</p>
                    <p className="text-muted-foreground font-medium">AI sizin izahlarınızı dərindən araşdırır.</p>
                  </div>
                </div>
              ) : (
                (exam.questions || []).filter((q: any) => q.type === 'explanation').length === 0 ? (
                  <div className="bg-card rounded-[2rem] p-16 text-center text-muted-foreground font-bold shadow-sm border border-border/50">
                    Bu imtahanda izahlı sual yoxdur.
                  </div>
                ) : (
                  (exam.questions || []).filter((q: any) => q.type === 'explanation').map((q: any) => (
                    <Card key={q.id} className="border border-border/50 shadow-xl rounded-[2.5rem] bg-card/50 overflow-hidden group">
                      <CardHeader className="p-8 border-b border-border/50 bg-muted/20">
                        <div className="flex justify-between items-start gap-6">
                          <p className="font-black text-xl text-foreground leading-tight pr-10">{q.text}</p>
                          <div className="bg-card px-6 py-3 rounded-2xl shadow-lg border border-primary/20">
                            <span className="text-2xl font-black text-primary">
                              {aiFeedbacks[q.id]?.score !== undefined ? (aiFeedbacks[q.id].score * 100).toFixed(0) : 0}%
                            </span>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="p-8 space-y-6">
                        <div className="space-y-2">
                          <h4 className="text-sm font-black text-muted-foreground uppercase tracking-widest">Sizin İzahınız:</h4>
                          <div className="bg-muted/30 p-6 rounded-2xl text-foreground leading-relaxed font-medium italic">
                            "{attempt.answers?.[q.id]?.explanation || 'İzah daxil edilməyib.'}"
                          </div>
                        </div>
                        <div className="bg-primary/10 p-8 rounded-[2rem] border border-primary/20 space-y-4 shadow-inner">
                          <div className="flex items-center gap-3 text-primary">
                            <BrainCircuit className="w-6 h-6" />
                            <h4 className="font-black text-lg">AI-nın Qiymətləndirməsi:</h4>
                          </div>
                          <p className="text-foreground leading-relaxed font-bold text-lg">
                            {aiFeedbacks[q.id]?.feedback || 'Yoxlama zamanı xəta baş verdi.'}
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}