
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Award, Share2, ArrowLeft, BrainCircuit, Loader2 } from 'lucide-react';
import { gradeExplanationQuestion } from '@/ai/flows/grade-explanation-question-flow';
import { useFirestore } from '@/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';

export default function Results() {
  const { code } = useParams();
  const router = useRouter();
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
        // Find the access code directly by ID
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

        // Fetch exam and attempt data concurrently
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
  }, [code, firestore, router]);

  const gradeExplanations = async (e: any, a: any) => {
    setIsGrading(true);
    const feedbacks: Record<string, any> = {};
    
    // Process only explanation type questions
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
    
    // Save AI results back to the attempt document
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-slate-500 font-medium">Nəticələr hazırlanır...</p>
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
        // For explanation, final answer must be correct to get points from AI score
        const isFinalCorrect = studentFinal === correctFinal;
        const aiResult = aiFeedbacks[q.id];
        if (isFinalCorrect && aiResult) earnedPoints += aiResult.score;
      }
    });
    
    return questions.length > 0 ? (earnedPoints / questions.length) * 100 : 0;
  };

  const totalScore = calculateTotalScore();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => router.push('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Ana Səhifə
          </Button>
          <Button variant="outline">
            <Share2 className="w-4 h-4 mr-2" />
            Nəticəni paylaş
          </Button>
        </header>

        <Card className="border-none shadow-2xl bg-gradient-to-br from-primary to-primary/80 text-white text-center py-12 px-6 overflow-hidden relative">
          <div className="relative z-10">
            <div className="mx-auto bg-white/20 p-5 rounded-full w-fit mb-6">
              <Award className="w-16 h-16" />
            </div>
            <CardTitle className="text-4xl font-bold mb-2">İmtahan Tamamlandı!</CardTitle>
            <CardDescription className="text-primary-foreground/90 text-lg mb-8">
              {attempt.studentFirstName} {attempt.studentLastName}, sizin nəticəniz hazırdır.
            </CardDescription>
            <div>
              <div className="text-8xl font-black mb-2">{Math.round(totalScore)}%</div>
              <div className="text-sm uppercase tracking-[0.2em] opacity-80 font-bold">Ümumi Bal</div>
            </div>
          </div>
          {/* Decorative background circle */}
          <div className="absolute -bottom-20 -right-20 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card className="p-6 border-none shadow-sm">
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-6">Sual Statistikası</h3>
            <div className="space-y-4">
              {(exam.questions || []).map((q: any, i: number) => {
                const ans = attempt.answers?.[q.id];
                const isCorrect = ans?.finalAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();
                return (
                  <div key={q.id} className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0">
                    <div className="flex flex-col">
                      <span className="text-slate-800 font-semibold">Sual {i + 1}</span>
                      <span className="text-[10px] text-slate-400 uppercase">{q.type === 'explanation' ? 'İzahlı' : q.type === 'mcq' ? 'Test' : 'Açıq'}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {q.type === 'explanation' ? (
                        <div className="flex items-center gap-2">
                          {isCorrect ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />}
                          <span className="text-xs px-2 py-1 bg-primary/10 text-primary font-bold rounded">
                            AI: {aiFeedbacks[q.id]?.score !== undefined ? `${(aiFeedbacks[q.id].score * 100).toFixed(0)}%` : '...'}
                          </span>
                        </div>
                      ) : (
                        isCorrect ? <CheckCircle2 className="w-6 h-6 text-green-500" /> : <XCircle className="w-6 h-6 text-red-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-6 border-none shadow-sm">
            <h3 className="text-slate-500 text-xs font-bold uppercase tracking-widest mb-6">AI Qiymətləndirmə (İzahlar)</h3>
            <div className="space-y-6">
              {isGrading ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <BrainCircuit className="w-12 h-12 mb-4 animate-pulse text-primary/40" />
                  <p className="text-sm font-medium">AI sizin izahlarınızı analiz edir...</p>
                </div>
              ) : (
                (exam.questions || []).filter((q: any) => q.type === 'explanation').length === 0 ? (
                  <div className="text-center py-16 text-slate-400 text-sm">İzahlı sual yoxdur.</div>
                ) : (
                  (exam.questions || []).filter((q: any) => q.type === 'explanation').map((q: any) => (
                    <div key={q.id} className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-4">
                      <div className="flex justify-between items-start">
                        <p className="font-bold text-sm text-slate-700 leading-tight pr-4">{q.text.substring(0, 60)}...</p>
                        <span className="font-bold text-primary bg-white px-2 py-1 rounded shadow-sm text-xs">
                          {aiFeedbacks[q.id]?.score !== undefined ? (aiFeedbacks[q.id].score * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] font-bold">
                        <span className={`px-2 py-0.5 rounded ${attempt.answers?.[q.id]?.finalAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase() ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                          Son Cavab: {attempt.answers?.[q.id]?.finalAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase() ? 'Doğru' : 'Yanlış'}
                        </span>
                      </div>
                      <div className="bg-white p-4 rounded-lg border border-slate-100 text-xs leading-relaxed text-slate-600 shadow-sm">
                        <div className="flex items-center gap-2 mb-2 text-primary font-bold">
                          <BrainCircuit className="w-4 h-4" />
                          <span>Süni İntellekt Rəyi:</span>
                        </div>
                        {aiFeedbacks[q.id]?.feedback || 'Bu sual üçün izah yoxlanılmayıb.'}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
