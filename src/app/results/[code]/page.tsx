
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
    <div className="min-h-screen bg-background p-6 font-body pb-24 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] pointer-events-none" />

      <div className="max-w-5xl mx-auto space-y-12 relative z-10">
        <header className="flex justify-between items-center sticky top-0 z-[60] bg-background/20 backdrop-blur-2xl py-4 px-6 rounded-3xl border border-white/10 shadow-2xl">
          <Button variant="ghost" onClick={() => router.push('/')} className="rounded-xl font-bold hover:bg-muted/50 shadow-sm border border-transparent">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Ana Səhifə
          </Button>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button variant="outline" className="rounded-xl font-bold bg-background/50 backdrop-blur-md shadow-sm border-white/10 hover:scale-105 transition-all" onClick={handleShare}>
              <Share2 className="w-5 h-5 mr-2" />
              Paylaş
            </Button>
          </div>
        </header>

        {/* Hero Score Card */}
        <Card className="border-none shadow-[0_32px_64px_-15px_rgba(0,0,0,0.4)] bg-gradient-to-br from-primary via-primary/80 to-blue-700 text-white rounded-[4rem] overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-12 opacity-5 rotate-12 group-hover:rotate-0 transition-transform duration-1000">
            <Trophy className="w-80 h-80 text-white" />
          </div>
          <CardContent className="relative z-10 py-20 flex flex-col items-center">
            <div className="bg-white/10 p-8 rounded-[2.5rem] backdrop-blur-md mb-8 shadow-2xl border border-white/20 animate-bounce">
              <Award className="w-20 h-20 text-white" />
            </div>
            <CardTitle className="text-5xl font-black mb-4 drop-shadow-2xl text-white tracking-tight">İmtahan Tamamlandı!</CardTitle>
            <CardDescription className="text-white/80 text-xl font-semibold mb-12 max-w-lg text-center leading-relaxed">
              Əla iş! <span className="text-white font-black underline decoration-white/30 decoration-4 underline-offset-8">{attempt.studentFirstName} {attempt.studentLastName}</span>, nəticəniz artıq rəsmidir.
            </CardDescription>
            
            <div className="flex flex-col items-center">
              <div className="relative text-[10rem] font-black leading-none flex items-center text-white tabular-nums drop-shadow-[0_25px_50px_rgba(0,0,0,0.5)]">
                {earnedPoints.toFixed(earnedPoints % 1 === 0 ? 0 : 2)}
                <span className="text-4xl font-black mx-6 opacity-30">/</span>
                <span className="text-6xl font-black opacity-50">{maxPoints}</span>
              </div>
              <div className="mt-8 text-xs uppercase tracking-[0.6em] font-black bg-white/10 px-10 py-3 rounded-full border border-white/20 text-white shadow-xl backdrop-blur-sm">
                Yekun Bal Hesabı
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Question Navigation Grid */}
        <div className="space-y-8">
          <div className="flex items-center gap-4 px-4">
            <div className="bg-primary/20 p-2.5 rounded-2xl">
              <ListChecks className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-2xl font-black text-foreground">Sual Naviqasiyası</h3>
          </div>
          <div className="grid grid-cols-5 sm:grid-cols-10 gap-5 bg-card/30 backdrop-blur-3xl p-10 rounded-[3rem] border border-white/10 shadow-2xl">
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
                    "relative w-full aspect-square flex items-center justify-center bg-card rounded-2xl text-xl font-black shadow-xl transition-all hover:scale-110 active:scale-90 border-b-[10px]",
                    score === 1 ? "border-green-500 text-green-500" : 
                    score > 0 ? "border-lime-400 text-lime-400" : 
                    "border-red-500 text-red-500"
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Detailed Question Review List */}
        <div className="space-y-16 mt-20">
          <div className="flex items-center gap-4 px-4">
            <div className="bg-primary/20 p-2.5 rounded-2xl">
              <Sparkles className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-3xl font-black text-foreground">Ətraflı İcmal</h3>
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
                  "border-none shadow-[0_32px_64px_-15px_rgba(0,0,0,0.2)] rounded-[3.5rem] overflow-hidden bg-card/40 backdrop-blur-3xl transition-all duration-700 border-l-[12px]",
                  score === 1 ? "border-green-500" : score > 0 ? "border-lime-400" : "border-red-500"
                )}
              >
                <CardHeader className="p-10 border-b border-white/5 bg-muted/10">
                  <div className="flex justify-between items-start gap-6">
                    <div className="flex items-center gap-6">
                      <div className={cn(
                        "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black shadow-2xl",
                        score === 1 ? "bg-green-500 text-white" : score > 0 ? "bg-lime-400 text-white" : "bg-red-500 text-white"
                      )}>
                        {i + 1}
                      </div>
                      <div>
                        <CardTitle className="text-2xl font-black tracking-tight">Sual {i + 1}</CardTitle>
                        <CardDescription className="font-black uppercase tracking-[0.2em] text-[10px] opacity-50 mt-1">
                          {q.type === 'explanation' ? 'AI Dəstəkli İzah' : q.type === 'mcq' ? 'Çoxvariantlı Test' : 'Açıq Sual'}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge className={cn(
                      "rounded-full px-8 py-3 font-black text-lg shadow-xl",
                      score === 1 ? "bg-green-500" : score > 0 ? "bg-lime-400" : "bg-red-500"
                    )}>
                      {score.toFixed(2)} Bal
                    </Badge>
                  </div>
                </CardHeader>
                
                <CardContent className="p-12 space-y-12">
                  <div className="space-y-8">
                    <p className="text-3xl font-black text-foreground leading-tight tracking-tight">{q.text}</p>
                    {q.image && (
                      <div className="max-w-xl rounded-[2.5rem] overflow-hidden border-8 border-white/5 shadow-2xl mx-auto ring-1 ring-white/10 group">
                        <img src={q.image} alt="Sual şəkli" className="w-full h-auto transition-transform duration-700 group-hover:scale-105" />
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    {/* Student Answer */}
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground flex items-center gap-2">
                        <ChevronDown className="w-4 h-4" />
                        Sizin Cavabınız
                      </h4>
                      <div className={cn(
                        "p-8 rounded-[2.5rem] border-2 shadow-inner font-black text-2xl flex items-center gap-6",
                        score === 1 ? "bg-green-500/5 border-green-500/20 text-green-500" :
                        score > 0 ? "bg-lime-400/5 border-lime-400/20 text-lime-600" :
                        "bg-red-500/5 border-red-500/20 text-red-500"
                      )}>
                        {score === 1 ? <CheckCircle2 className="w-8 h-8" /> : score > 0 ? <CheckCircle2 className="w-8 h-8" /> : <XCircle className="w-8 h-8" />}
                        {studentFinal}
                      </div>
                      {q.type === 'explanation' && (
                        <div className="bg-background/40 backdrop-blur-xl p-8 rounded-[2rem] text-lg font-medium italic border border-white/10 text-foreground/80 leading-relaxed shadow-lg">
                          <span className="font-black text-[10px] block mb-3 opacity-30 uppercase tracking-widest">Daxil Etdiyiniz İzah:</span>
                          "{ans?.explanation || 'İzah yazılmayıb.'}"
                        </div>
                      )}
                    </div>

                    {/* Correct Answer */}
                    <div className="space-y-6">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-primary flex items-center gap-2">
                        <ChevronDown className="w-4 h-4" />
                        Sistemin Doğru Cavabı
                      </h4>
                      <div className="p-8 rounded-[2.5rem] bg-primary/5 border-2 border-primary/20 text-primary font-black text-2xl shadow-inner flex items-center gap-6">
                        <CheckCircle2 className="w-8 h-8" />
                        {correctFinal}
                      </div>
                      {q.type === 'explanation' && q.explanationCriterion && (
                        <div className="bg-primary/5 backdrop-blur-xl p-8 rounded-[2rem] text-lg font-medium text-primary/80 border border-primary/20 leading-relaxed shadow-lg">
                          <span className="font-black text-[10px] block mb-3 opacity-30 uppercase tracking-widest">Qiymətləndirmə Meyarı:</span>
                          {q.explanationCriterion}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* AI Feedback Section */}
                  {q.type === 'explanation' && aiFeedbacks[q.id] && (
                    <div className="bg-primary/10 backdrop-blur-3xl p-10 rounded-[3rem] border-4 border-primary/20 shadow-2xl space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
                      <div className="flex items-center gap-4 text-primary">
                        <div className="bg-primary/20 p-3 rounded-2xl">
                          <BrainCircuit className="w-8 h-8" />
                        </div>
                        <h4 className="text-2xl font-black tracking-tight">AI Analizi və Rəyi</h4>
                      </div>
                      <p className="text-xl font-bold leading-relaxed text-foreground opacity-90">
                        {aiFeedbacks[q.id].feedback}
                      </p>
                    </div>
                  )}

                  {/* Appeal Action */}
                  {q.type === 'explanation' && (
                    <div className="flex justify-end pt-8 border-t border-white/5">
                      {existingAppeal ? (
                        <Badge variant={existingAppeal.status === 'approved' ? 'default' : existingAppeal.status === 'rejected' ? 'destructive' : 'secondary'} className="rounded-2xl py-3 px-8 font-black text-sm shadow-xl">
                          {existingAppeal.status === 'pending' ? 'APELYASİYA GÖZLƏMƏDƏ' : existingAppeal.status === 'approved' ? `TƏSDİQLƏNDİ (+${existingAppeal.awardedScore})` : 'RƏDD EDİLDİ'}
                        </Badge>
                      ) : (
                        <Dialog>
                          <DialogTrigger asChild>
                            <Button variant="outline" className="rounded-2xl font-black py-7 px-10 gap-3 hover:bg-primary/10 hover:text-primary transition-all border-primary/30 text-primary text-lg shadow-xl">
                              <MessageSquarePlus className="w-6 h-6" />
                              Müraciət Et
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="rounded-[3rem] bg-card/90 backdrop-blur-3xl border-white/10 shadow-3xl">
                            <DialogHeader className="p-4">
                              <DialogTitle className="text-3xl font-black tracking-tight">Apelyasiya Müraciəti</DialogTitle>
                              <DialogDescription className="font-bold text-lg mt-2">
                                Qiymətləndirmə ilə razı deyilsinizsə, səbəbi bildirin.
                              </DialogDescription>
                            </DialogHeader>
                            <div className="py-6">
                              <Textarea 
                                placeholder="Məsələn: Həll yolunda düsturu doğru qeyd etmişəm, lakin AI bal kəsib..."
                                value={appealReason}
                                onChange={(e) => setAppealReason(e.target.value)}
                                className="min-h-[200px] rounded-3xl border-2 border-white/10 bg-background/50 text-xl p-8 focus:ring-8 focus:ring-primary/20 shadow-inner"
                              />
                            </div>
                            <DialogFooter className="p-4">
                              <Button className="rounded-2xl font-black h-16 px-12 text-xl bg-primary shadow-2xl hover:scale-105 transition-all text-white" onClick={() => handleAppeal(q.id)} disabled={isSubmittingAppeal}>
                                {isSubmittingAppeal ? 'Göndərilir...' : 'Müraciəti Göndər'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
