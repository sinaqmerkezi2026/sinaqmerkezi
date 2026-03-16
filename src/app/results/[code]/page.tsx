"use client";

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Award, Share2, ArrowLeft, BrainCircuit, Loader2, Sparkles, Trophy, MessageSquarePlus, Clock, ChevronDown, ListChecks } from 'lucide-react';
import { gradeExplanationQuestion } from '@/ai/flows/grade-explanation-question-flow';
import { useFirestore, useCollection, useMemoFirebase, useDoc } from '@/firebase';
import { doc, getDoc, updateDoc, collection, setDoc, query, where } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';

export default function Results() {
  const { code } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [isGrading, setIsGrading] = useState(false);
  const [appealReason, setAppealReason] = useState("");
  const [isSubmittingAppeal, setIsSubmittingAppeal] = useState(false);

  // Get Access Code Doc
  const cleanCode = code?.toString().trim().toUpperCase();
  const codeRef = useMemoFirebase(() => 
    cleanCode ? doc(firestore, 'accessCodes', cleanCode) : null,
    [firestore, cleanCode]
  );
  const { data: codeData, isLoading: isCodeLoading } = useDoc(codeRef);

  // Get Attempt Doc
  const attemptRef = useMemoFirebase(() => 
    codeData?.studentAttemptId ? doc(firestore, 'studentAttempts', codeData.studentAttemptId) : null,
    [firestore, codeData?.studentAttemptId]
  );
  const { data: attempt, isLoading: isAttemptLoading } = useDoc(attemptRef);

  // Get Exam Doc
  const examRef = useMemoFirebase(() => 
    attempt?.examId ? doc(firestore, 'exams', attempt.examId) : null,
    [firestore, attempt?.examId]
  );
  const { data: exam, isLoading: isExamLoading } = useDoc(examRef);

  // Get Appeals
  const appealsQuery = useMemoFirebase(() => 
    attempt?.id ? query(collection(firestore, 'appeals'), where('attemptId', '==', attempt.id)) : null,
    [firestore, attempt?.id]
  );
  const { data: appeals } = useCollection(appealsQuery);

  const calculatePoints = (e: any, a: any, feedbacks: any) => {
    let earnedPoints = 0;
    const questions = e.questions || [];
    
    questions.forEach((q: any) => {
      const ans = a.answers?.[q.id];
      if (!ans) return;

      const studentFinal = ans.finalAnswer?.trim().toLowerCase();
      const correctFinal = q.correctAnswer?.trim().toLowerCase();

      if (q.type === 'mcq' || q.type === 'open') {
        if (studentFinal === correctFinal) earnedPoints += 1;
      } else if (q.type === 'explanation') {
        const aiResult = feedbacks[q.id];
        if (aiResult) earnedPoints += aiResult.score;
      }
    });
    
    return earnedPoints;
  };

  const gradeExplanations = async (e: any, a: any) => {
    if (isGrading) return;
    setIsGrading(true);
    const feedbacks: Record<string, any> = {};
    
    const explanationQuestions = (e.questions || []).filter((q: any) => q.type === 'explanation');
    
    for (const q of explanationQuestions) {
      const studentAns = a.answers?.[q.id];
      const studentFinal = studentAns?.finalAnswer?.trim().toLowerCase();
      const correctFinal = q.correctAnswer?.trim().toLowerCase();
      const isFinalCorrect = studentFinal === correctFinal;

      if (studentAns?.explanation || studentAns?.finalAnswer) {
        try {
          const result = await gradeExplanationQuestion({
            studentExplanation: studentAns.explanation || "",
            adminExplanationCriterion: q.explanationCriterion || q.correctAnswer,
            isFinalAnswerCorrect: isFinalCorrect
          });
          feedbacks[q.id] = result;
        } catch (err) {
          console.error(`Grading error for Q ${q.id}:`, err);
          feedbacks[q.id] = { score: 0, feedback: 'AI qiymətləndirmə zamanı xəta baş verdi.' };
        }
      } else {
        feedbacks[q.id] = { score: 0, feedback: 'Cavab və ya izah daxil edilməyib.' };
      }
    }
    
    const earnedPoints = calculatePoints(e, a, feedbacks);
    const maxPoints = e.questions?.length || 0;
    const totalScore = maxPoints > 0 ? (earnedPoints / maxPoints) * 100 : 0;
    
    try {
      const aRef = doc(firestore, 'studentAttempts', a.id);
      await updateDoc(aRef, { 
        results: feedbacks,
        totalScore: totalScore,
        earnedPoints: earnedPoints,
        maxPoints: maxPoints
      });
    } catch (err) {
      console.error("Failed to save AI results:", err);
    }
    
    setIsGrading(false);
  };

  useEffect(() => {
    if (exam && attempt && !attempt.results && !isGrading) {
      gradeExplanations(exam, attempt);
    }
  }, [exam, attempt, isGrading]);

  const handleAppeal = async (questionId: string) => {
    if (!appealReason.trim()) {
      toast({ title: 'Xəta', description: 'Zəhmət olmasa səbəbi qeyd edin.', variant: 'destructive' });
      return;
    }

    setIsSubmittingAppeal(true);
    try {
      const appealId = Math.random().toString(36).substr(2, 9);
      const appealRef = doc(firestore, 'appeals', appealId);
      
      await setDoc(appealRef, {
        id: appealId,
        attemptId: attempt.id,
        questionId,
        studentName: `${attempt.studentFirstName} ${attempt.studentLastName}`,
        studentReason: appealReason,
        status: 'pending',
        createdAt: Date.now()
      });

      toast({ title: 'Uğurlu', description: 'Apelyasiya müraciətiniz göndərildi.' });
      setAppealReason("");
    } catch (e) {
      toast({ title: 'Xəta', description: 'Müraciət göndərilmədi.', variant: 'destructive' });
    } finally {
      setIsSubmittingAppeal(false);
    }
  };

  const handleShare = () => {
    const url = `${window.location.origin}/results/${code}`;
    navigator.clipboard.writeText(url).then(() => {
      toast({ title: "Link kopyalandı", description: "Nəticə linki müvəffəqiyyətlə yaddaşa kopyalandı." });
    });
  };

  const scrollToQuestion = (id: string) => {
    const el = document.getElementById(`q-review-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  if (isCodeLoading || isAttemptLoading || isExamLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6">
          <Loader2 className="w-20 h-20 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-black text-2xl">Nəticələr hazırlanır...</p>
        </div>
      </div>
    );
  }

  if (!exam || !attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-black">Nəticə tapılmadı</h2>
          <Button onClick={() => router.push('/')}>Ana Səhifəyə Qayıt</Button>
        </div>
      </div>
    );
  }

  const aiFeedbacks = attempt.results || {};
  const earnedPoints = attempt.earnedPoints ?? calculatePoints(exam, attempt, aiFeedbacks);
  const maxPoints = exam.questions?.length || 0;

  return (
    <div className="min-h-screen bg-background p-6 font-body pb-24">
      <div className="max-w-5xl mx-auto space-y-12">
        <header className="flex justify-between items-center sticky top-0 z-[60] bg-background/80 backdrop-blur-md py-4">
          <Button variant="ghost" onClick={() => router.push('/')} className="rounded-xl font-bold hover:bg-muted shadow-sm">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Ana Səhifə
          </Button>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="outline" className="rounded-xl font-bold bg-card shadow-sm border-border/50" onClick={handleShare}>
              <Share2 className="w-5 h-5 mr-2" />
              Paylaş
            </Button>
          </div>
        </header>

        {/* Hero Score Card */}
        <Card className="border-none shadow-2xl bg-gradient-to-br from-primary via-primary/80 to-blue-900 text-white rounded-[3rem] overflow-hidden relative">
          <div className="absolute top-0 right-0 p-10 opacity-5 rotate-12">
            <Trophy className="w-64 h-64 text-white" />
          </div>
          <CardContent className="relative z-10 py-16 flex flex-col items-center">
            <div className="bg-white/10 p-6 rounded-[2rem] backdrop-blur-md mb-6 shadow-2xl border border-white/20">
              <Award className="w-16 h-16 text-white" />
            </div>
            <CardTitle className="text-4xl font-black mb-3 drop-shadow-md text-white">İmtahan Bitdi!</CardTitle>
            <CardDescription className="text-white/80 text-lg font-medium mb-8 max-w-lg text-center">
              Təbriklər <span className="text-white font-black">{attempt.studentFirstName} {attempt.studentLastName}</span>, nəticəniz hesablandı.
            </CardDescription>
            
            <div className="flex flex-col items-center">
              <div className="relative text-[8rem] font-black leading-none flex items-center text-white tabular-nums drop-shadow-2xl">
                {earnedPoints.toFixed(earnedPoints % 1 === 0 ? 0 : 2)}
                <span className="text-3xl font-bold mx-4 opacity-40">/</span>
                <span className="text-5xl font-bold opacity-60">{maxPoints}</span>
              </div>
              <div className="mt-4 text-xs uppercase tracking-[0.5em] font-black bg-white/10 px-8 py-2 rounded-full border border-white/20 text-white">
                Ümumi Bal Hesabı
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question Navigation Grid (The Image Request) */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <ListChecks className="w-6 h-6 text-primary" />
            <h3 className="text-xl font-black text-foreground">Sual Naviqasiyası</h3>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-4 bg-card/30 p-8 rounded-[2.5rem] border border-border/50 shadow-inner">
            {(exam.questions || []).map((q: any, i: number) => {
              const ans = attempt.answers?.[q.id];
              const studentFinal = ans?.finalAnswer?.trim().toLowerCase();
              const correctFinal = q.correctAnswer?.trim().toLowerCase();
              const isCorrect = studentFinal === correctFinal;
              const score = q.type === 'explanation' ? (aiFeedbacks[q.id]?.score || 0) : (isCorrect ? 1 : 0);

              return (
                <button
                  key={q.id}
                  onClick={() => scrollToQuestion(q.id)}
                  className={cn(
                    "relative w-full aspect-square flex items-center justify-center bg-white dark:bg-card rounded-xl text-lg font-black shadow-lg transition-all hover:scale-105 active:scale-95 border-b-8",
                    score === 1 ? "border-green-600 text-green-600" : 
                    score > 0 ? "border-lime-500 text-lime-500" : 
                    "border-red-600 text-red-600"
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Question Review List */}
        <div className="space-y-12 mt-16">
          <div className="flex items-center gap-3 px-2">
            <Sparkles className="w-6 h-6 text-primary" />
            <h3 className="text-2xl font-black text-foreground">Ətraflı İcmal</h3>
          </div>

          {(exam.questions || []).map((q: any, i: number) => {
            const ans = attempt.answers?.[q.id];
            const studentFinal = ans?.finalAnswer || "Cavab yoxdur";
            const correctFinal = q.correctAnswer;
            const isCorrect = studentFinal.trim().toLowerCase() === correctFinal.trim().toLowerCase();
            const score = q.type === 'explanation' ? (aiFeedbacks[q.id]?.score || 0) : (isCorrect ? 1 : 0);
            const existingAppeal = appeals?.find(a => a.questionId === q.id);

            return (
              <Card 
                key={q.id} 
                id={`q-review-${q.id}`}
                className={cn(
                  "border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-card/50 backdrop-blur-sm transition-all duration-500 border-l-8",
                  score === 1 ? "border-green-500" : score > 0 ? "border-lime-500" : "border-red-500"
                )}
              >
                <CardHeader className="p-8 border-b border-border/50 bg-muted/20">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner",
                        score === 1 ? "bg-green-500 text-white" : score > 0 ? "bg-lime-500 text-white" : "bg-red-500 text-white"
                      )}>
                        {i + 1}
                      </div>
                      <div>
                        <CardTitle className="text-xl font-black">Sual {i + 1}</CardTitle>
                        <CardDescription className="font-bold uppercase tracking-wider text-[10px]">
                          {q.type === 'explanation' ? 'AI İzahlı' : q.type === 'mcq' ? 'Qapalı' : 'Açıq'}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={cn(
                      "rounded-full px-6 py-2 font-black text-sm shadow-md",
                      score === 1 ? "bg-green-500" : score > 0 ? "bg-lime-500" : "bg-red-500"
                    )}>
                      {score.toFixed(2)} Bal
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="p-10 space-y-10">
                  <div className="space-y-6">
                    <p className="text-2xl font-bold text-foreground leading-tight">{q.text}</p>
                    {q.image && (
                      <div className="max-w-lg rounded-3xl overflow-hidden border-4 border-muted/50 shadow-xl mx-auto">
                        <img src={q.image} alt="Sual şəkli" className="w-full h-auto" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Student Answer */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <ChevronDown className="w-4 h-4" />
                        Sizin Cavabınız
                      </h4>
                      <div className={cn(
                        "p-6 rounded-[2rem] border-2 shadow-inner font-black text-xl flex items-center gap-4",
                        score === 1 ? "bg-green-500/5 border-green-500/20 text-green-600" :
                        score > 0 ? "bg-lime-500/5 border-lime-500/20 text-lime-600" :
                        "bg-red-500/5 border-red-500/20 text-red-600"
                      )}>
                        {score === 1 ? <CheckCircle2 className="w-6 h-6" /> : score > 0 ? <CheckCircle2 className="w-6 h-6" /> : <XCircle className="w-6 h-6" />}
                        {studentFinal}
                      </div>
                      {q.type === 'explanation' && (
                        <div className="bg-muted/30 p-6 rounded-2xl text-sm italic border border-border/50 text-foreground/80 leading-relaxed">
                          <span className="font-black text-[10px] block mb-2 opacity-50 uppercase">Ətraflı İzahınız:</span>
                          "{ans?.explanation || 'İzah yazılmayıb.'}"
                        </div>
                      )}
                    </div>

                    {/* Correct Answer */}
                    <div className="space-y-4">
                      <h4 className="text-xs font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <ChevronDown className="w-4 h-4" />
                        Doğru Cavab
                      </h4>
                      <div className="p-6 rounded-[2rem] bg-primary/5 border-2 border-primary/20 text-primary font-black text-xl shadow-inner flex items-center gap-4">
                        <CheckCircle2 className="w-6 h-6" />
                        {correctFinal}
                      </div>
                      {q.type === 'explanation' && q.explanationCriterion && (
                        <div className="bg-primary/5 p-6 rounded-2xl text-sm text-primary/80 border border-primary/20 leading-relaxed">
                          <span className="font-black text-[10px] block mb-2 opacity-50 uppercase">Qiymətləndirmə Meyarı:</span>
                          {q.explanationCriterion}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Feedback Section */}
                  {q.type === 'explanation' && aiFeedbacks[q.id] && (
                    <div className="bg-primary/10 p-8 rounded-[2.5rem] border-4 border-primary/20 shadow-xl space-y-4 animate-in fade-in slide-in-from-bottom-4">
                      <div className="flex items-center gap-3 text-primary">
                        <BrainCircuit className="w-8 h-8" />
                        <h4 className="text-xl font-black">AI-nın Qiymətləndirməsi</h4>
                      </div>
                      <p className="text-lg font-bold leading-relaxed text-foreground">
                        {aiFeedbacks[q.id].feedback}
                      </p>
                    </div>
                  )}

                  {/* Appeal Action */}
                  <div className="flex justify-end pt-4 border-t border-border/50">
                    {existingAppeal ? (
                      <Badge variant={existingAppeal.status === 'approved' ? 'default' : existingAppeal.status === 'rejected' ? 'destructive' : 'secondary'} className="rounded-xl py-2 px-6 font-black">
                        {existingAppeal.status === 'pending' ? 'Apelyasiya Gözləmədə' : existingAppeal.status === 'approved' ? `Təsdiqləndi (+${existingAppeal.awardedScore})` : 'Apelyasiya Rədd Edildi'}
                      </Badge>
                    ) : (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="rounded-xl font-black gap-2 hover:bg-primary/10 hover:text-primary transition-all border-primary/20 text-primary">
                            <MessageSquarePlus className="w-4 h-4" />
                            Apelyasiya Ver
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="rounded-[2rem]">
                          <DialogHeader>
                            <DialogTitle className="text-2xl font-black">Apelyasiya Müraciəti</DialogTitle>
                            <DialogDescription className="font-medium">
                              Bu sualın qiymətləndirilməsində səhv olduğunu düşünürsünüzsə, səbəbi ətraflı qeyd edin.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="py-4">
                            <Textarea 
                              placeholder="Məs: Hesablamam düzdür, lakin AI teoremi səhv sayıb..."
                              value={appealReason}
                              onChange={(e) => setAppealReason(e.target.value)}
                              className="min-h-[150px] rounded-2xl border-2 focus:ring-primary"
                            />
                          </div>
                          <DialogFooter>
                            <Button className="rounded-xl font-black px-8" onClick={() => handleAppeal(q.id)} disabled={isSubmittingAppeal}>
                              {isSubmittingAppeal ? 'Göndərilir...' : 'Müraciət Et'}
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
