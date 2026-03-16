
"use client";

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Timer, ChevronRight, ChevronLeft, Loader2, AlertCircle, Sparkles, GraduationCap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function ExamSession() {
  const { code } = useParams();
  const searchParams = useSearchParams();
  const attemptId = searchParams.get('attemptId');
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasCheckedStatus, setHasCheckedStatus] = useState(false);

  const attemptRef = useMemoFirebase(() => 
    attemptId ? doc(firestore, 'studentAttempts', attemptId) : null, 
    [firestore, attemptId]
  );
  const { data: attempt, isLoading: isAttemptLoading } = useDoc(attemptRef);

  const examRef = useMemoFirebase(() => 
    attempt?.examId ? doc(firestore, 'exams', attempt.examId) : null,
    [firestore, attempt?.examId]
  );
  const { data: exam, isLoading: isExamLoading } = useDoc(examRef);

  const handleFinish = useCallback(async () => {
    if (isSubmitting || !attempt || !attemptRef) return;
    setIsSubmitting(true);
    
    try {
      await updateDoc(attemptRef, { 
        endTime: Date.now(),
        isCompleted: true 
      });
      toast({ title: 'İmtahan bitdi', description: 'Nəticələriniz hesablanır...' });
      router.push(`/results/${code}`);
    } catch (e) {
      setIsSubmitting(false);
      toast({ title: 'Xəta', description: 'İmtahanı bitirmək mümkün olmadı.', variant: 'destructive' });
    }
  }, [attempt, attemptRef, code, isSubmitting, router, toast]);

  // Initial redirect check
  useEffect(() => {
    if (attemptId && !isAttemptLoading) {
      if (!attempt) {
        const timer = setTimeout(() => router.push('/'), 2000);
        return () => clearTimeout(timer);
      }
      if (attempt.endTime) {
        router.push(`/results/${code}`);
      }
      setHasCheckedStatus(true);
    }
  }, [attempt, isAttemptLoading, attemptId, router, code]);

  // Initialize Timer
  useEffect(() => {
    if (exam && attempt && !attempt.endTime && timeLeft === null) {
      const startTime = attempt.startTime;
      const durationSeconds = (exam.durationMinutes || 60) * 60;
      const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
      const remaining = Math.max(0, durationSeconds - elapsedSeconds);
      setTimeLeft(remaining);
    }
  }, [exam, attempt, timeLeft]);

  // Timer Countdown Logic
  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0 || !hasCheckedStatus) {
      if (timeLeft === 0) handleFinish();
      return;
    }

    const timerId = setInterval(() => {
      setTimeLeft(prev => {
        if (prev === null) return null;
        if (prev <= 1) {
          clearInterval(timerId);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timerId);
  }, [timeLeft === null, hasCheckedStatus, handleFinish]);

  const updateAnswer = async (qId: string, finalAnswer: string, explanation?: string) => {
    if (!attempt || !attemptRef) return;
    
    const currentAnswers = attempt.answers || {};
    const newAnswers = {
      ...currentAnswers,
      [qId]: { 
        ...currentAnswers[qId],
        finalAnswer, 
        explanation: explanation !== undefined ? explanation : (currentAnswers[qId]?.explanation || '')
      }
    };

    try {
      await updateDoc(attemptRef, { answers: newAnswers });
    } catch (e) {
      console.error("Save answer error:", e);
    }
  };

  const formatTime = (seconds: number | null) => {
    if (seconds === null) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (!attemptId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Alert variant="destructive" className="max-w-md shadow-2xl rounded-2xl border-none">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="font-bold">Giriş xətası</AlertTitle>
          <AlertDescription>
            İmtahan sessiyası tapılmadı. Zəhmət olmasa yenidən giriş edin.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isAttemptLoading || !hasCheckedStatus || timeLeft === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6">
          <div className="relative">
            <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
            <Sparkles className="w-6 h-6 text-primary absolute top-0 right-0 animate-pulse" />
          </div>
          <p className="text-muted-foreground font-black text-xl">İmtahan sessiyası hazırlanır...</p>
        </div>
      </div>
    );
  }

  const questions = exam?.questions || [];
  const currentQ = questions[currentIdx];
  const progress = questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0;

  if (!exam || questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="text-center space-y-6">
          <AlertCircle className="w-20 h-20 text-red-500 mx-auto opacity-20" />
          <h2 className="text-3xl font-black text-foreground">Sual tapılmadı</h2>
          <p className="text-muted-foreground text-lg">Bu imtahanda hələ sual əlavə edilməyib.</p>
          <Button size="lg" className="rounded-2xl px-12" onClick={() => router.push('/')}>Geri qayıt</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col font-body relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

      <header className="bg-card/40 backdrop-blur-2xl border-b border-white/10 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="bg-primary/20 p-2.5 rounded-2xl shadow-lg">
            <GraduationCap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-black text-xl text-foreground hidden md:block">{exam.name}</h1>
            <p className="text-xs font-black text-muted-foreground uppercase tracking-[0.2em]">{attempt.studentFirstName} {attempt.studentLastName}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className={cn(
            "flex items-center gap-3 px-8 py-3 rounded-2xl font-mono text-2xl font-black transition-all duration-500 shadow-inner min-w-[150px] justify-center border-2",
            timeLeft < 300 ? 'bg-red-500/10 text-red-500 animate-pulse border-red-500/30' : 'bg-background/50 text-foreground border-white/10'
          )}>
            <Timer className={cn("w-6 h-6", timeLeft < 300 ? "text-red-500" : "text-primary")} />
            {formatTime(timeLeft)}
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button onClick={handleFinish} variant="destructive" className="font-black px-8 h-12 rounded-[1.2rem] shadow-xl hover:scale-105 transition-all text-white">
              Bitir
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto w-full p-6 flex-1 flex flex-col space-y-10 z-10">
        <div className="space-y-4 bg-card/20 backdrop-blur-xl p-8 rounded-[3rem] shadow-2xl border border-white/10">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <span className="text-xs font-black text-primary uppercase tracking-[0.3em]">İmtahan Tərəqqisi</span>
              <h2 className="text-3xl font-black text-foreground">Sual {currentIdx + 1} <span className="text-muted-foreground font-medium opacity-50">/ {questions.length}</span></h2>
            </div>
            <Badge className="text-xl font-black px-6 py-2 rounded-2xl bg-primary/10 text-primary border-primary/20">{Math.round(progress)}%</Badge>
          </div>
          <Progress value={progress} className="h-5 rounded-full bg-muted/30 border border-white/5" />
        </div>

        <Card className="shadow-2xl border border-white/10 rounded-[4rem] overflow-hidden bg-card/30 backdrop-blur-3xl flex-1 flex flex-col">
          <CardHeader className="p-12 border-b border-white/10 bg-muted/10">
            <CardTitle className="text-4xl font-black leading-[1.1] text-foreground tracking-tight">
              {currentQ.text}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-12 space-y-12 flex-1">
            {currentQ.image && (
              <div className="rounded-[3rem] border-[12px] border-white/5 overflow-hidden bg-card/50 shadow-2xl max-w-2xl mx-auto group ring-1 ring-white/10">
                <img 
                  src={currentQ.image} 
                  alt="Sual şəkli" 
                  className="w-full h-auto transition-transform duration-700 group-hover:scale-110" 
                />
              </div>
            )}

            <div className="space-y-8">
              {currentQ.type === 'mcq' && (
                <RadioGroup 
                  value={attempt.answers?.[currentQ.id]?.finalAnswer || ''} 
                  onValueChange={(val) => updateAnswer(currentQ.id, val)}
                  className="grid grid-cols-1 md:grid-cols-2 gap-8"
                >
                  {(currentQ.options || []).map((opt: string, i: number) => {
                    const isSelected = attempt.answers?.[currentQ.id]?.finalAnswer === opt;
                    return (
                      <Label 
                        key={i} 
                        className={cn(
                          "flex items-center gap-8 p-8 rounded-[2.5rem] border-4 cursor-pointer transition-all duration-500 relative overflow-hidden group shadow-lg",
                          isSelected 
                            ? "border-primary bg-primary/10 shadow-2xl scale-[1.03] ring-4 ring-primary/20" 
                            : "border-white/5 bg-background/20 hover:border-primary/40 hover:bg-muted/30 hover:scale-[1.01]"
                        )}
                      >
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black transition-all shadow-xl",
                          isSelected ? "bg-primary text-white scale-110" : "bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary"
                        )}>
                          {String.fromCharCode(65 + i)}
                        </div>
                        <span className="text-2xl font-bold text-foreground flex-1 tracking-tight">{opt}</span>
                        <RadioGroupItem value={opt} className="hidden" />
                      </Label>
                    );
                  })}
                </RadioGroup>
              )}

              {currentQ.type === 'open' && (
                <div className="max-w-2xl mx-auto space-y-6">
                  <div className="p-12 bg-muted/10 backdrop-blur-xl rounded-[4rem] border-4 border-dashed border-white/10 space-y-6 shadow-2xl flex flex-col items-center">
                    <Label className="text-2xl font-black text-foreground uppercase tracking-widest text-center opacity-70">Cavabınızı Daxil Edin</Label>
                    <Input 
                      className="h-24 text-5xl font-black text-center px-10 rounded-[2rem] border-none shadow-[0_20px_50px_rgba(0,0,0,0.3)] bg-background text-foreground focus:ring-8 focus:ring-primary/20 transition-all w-full"
                      value={attempt.answers?.[currentQ.id]?.finalAnswer || ''}
                      onChange={(e) => updateAnswer(currentQ.id, e.target.value)}
                      placeholder="..."
                    />
                  </div>
                </div>
              )}

              {currentQ.type === 'explanation' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                  <div className="space-y-6">
                    <Label className="text-2xl font-black text-foreground flex items-center gap-4">
                      <div className="bg-primary text-white w-12 h-12 rounded-[1.2rem] flex items-center justify-center text-xl shadow-2xl">1</div>
                      Ətraflı İzah
                    </Label>
                    <Textarea 
                      className="min-h-[450px] text-2xl leading-relaxed rounded-[3rem] border-4 border-white/5 p-10 shadow-2xl bg-background/30 focus:bg-background focus:ring-8 focus:ring-primary/20 transition-all text-foreground resize-none"
                      placeholder="Məsələnin həll yolunu və məntiqini ətraflı şəkildə bura yazın..."
                      value={attempt.answers?.[currentQ.id]?.explanation || ''}
                      onChange={(e) => updateAnswer(currentQ.id, attempt.answers?.[currentQ.id]?.finalAnswer || '', e.target.value)}
                    />
                  </div>
                  <div className="space-y-6">
                    <Label className="text-2xl font-black text-primary flex items-center gap-4">
                      <div className="bg-primary text-white w-12 h-12 rounded-[1.2rem] flex items-center justify-center text-xl shadow-2xl">2</div>
                      Yekun Nəticə
                    </Label>
                    <div className="p-12 bg-primary/5 rounded-[4rem] border-4 border-primary/20 shadow-2xl flex flex-col items-center justify-center space-y-10 flex-1">
                      <Input 
                        placeholder="Yekun cavab..."
                        className="h-24 bg-background text-5xl font-black text-center rounded-[2rem] border-none shadow-[0_25px_60px_rgba(0,0,0,0.4)] focus:ring-10 focus:ring-primary/30 w-full text-foreground"
                        value={attempt.answers?.[currentQ.id]?.finalAnswer || ''}
                        onChange={(e) => updateAnswer(currentQ.id, e.target.value, attempt.answers?.[currentQ.id]?.explanation)}
                      />
                      <div className="flex items-center gap-3 text-primary font-black bg-primary/10 px-8 py-3 rounded-full border border-primary/20 shadow-lg animate-pulse">
                        <Sparkles className="w-6 h-6" />
                        <span className="text-sm uppercase tracking-widest">AI Qiymətləndirmə Aktivdir</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col md:flex-row justify-between items-center gap-8 pb-16">
          <Button 
            variant="outline" 
            size="lg" 
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(p => p - 1)}
            className="rounded-[2rem] h-20 px-12 border-4 font-black text-xl bg-card/40 backdrop-blur-xl shadow-2xl hover:bg-muted hover:scale-105 transition-all disabled:opacity-20"
          >
            <ChevronLeft className="w-8 h-8 mr-3" />
            Əvvəlki
          </Button>

          <div className="flex flex-wrap justify-center gap-4 bg-background/20 backdrop-blur-3xl p-6 rounded-[3rem] border border-white/10 shadow-2xl">
            {questions.map((_: any, i: number) => {
              const isAnswered = !!attempt.answers?.[questions[i].id]?.finalAnswer;
              const isCurrent = i === currentIdx;
              return (
                <button
                  key={i}
                  onClick={() => setCurrentIdx(i)}
                  className={cn(
                    "w-14 h-14 rounded-2xl text-xl font-black transition-all duration-500 transform hover:scale-110 active:scale-90",
                    isCurrent 
                      ? "bg-primary text-white scale-125 shadow-[0_10px_30px_rgba(var(--primary),0.5)] z-10" 
                      : isAnswered 
                        ? "bg-primary/20 text-primary border-2 border-primary/30" 
                        : "bg-muted/30 border-2 border-white/5 text-muted-foreground/50 hover:border-primary/50"
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>

          <Button 
            size="lg"
            disabled={currentIdx === questions.length - 1}
            onClick={() => setCurrentIdx(p => p + 1)}
            className="rounded-[2rem] h-20 px-12 font-black text-xl shadow-[0_20px_50px_rgba(var(--primary),0.3)] hover:scale-110 hover:translate-x-2 transition-all text-white disabled:opacity-20"
          >
            Növbəti
            <ChevronRight className="w-8 h-8 ml-3" />
          </Button>
        </div>
      </div>
    </div>
  );
}
