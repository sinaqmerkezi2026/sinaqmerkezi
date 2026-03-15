"use client";

import { useEffect, useState } from 'react';
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
  const [timeLeft, setTimeLeft] = useState(0);
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

  useEffect(() => {
    if (exam && attempt && !attempt.endTime) {
      const elapsed = Math.floor((Date.now() - attempt.startTime) / 1000);
      const totalSeconds = (exam.durationMinutes || 60) * 60;
      const remaining = Math.max(0, totalSeconds - elapsed);
      setTimeLeft(remaining);
    }
  }, [exam, attempt]);

  useEffect(() => {
    if (timeLeft <= 0 || !hasCheckedStatus) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleFinish();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => setInterval(timer);
  }, [timeLeft, hasCheckedStatus]);

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

  const handleFinish = async () => {
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

  if (isAttemptLoading || !hasCheckedStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6">
          <div className="relative">
            <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
            <Sparkles className="w-6 h-6 text-primary absolute top-0 right-0 animate-pulse" />
          </div>
          <p className="text-muted-foreground font-bold text-xl">İmtahan sessiyası hazırlanır...</p>
        </div>
      </div>
    );
  }

  const questions = exam?.questions || [];
  const currentQ = questions[currentIdx];
  const progress = questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

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
    <div className="min-h-screen bg-background flex flex-col font-body">
      <header className="bg-card/80 backdrop-blur-md border-b border-border/50 px-6 py-4 flex justify-between items-center sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-primary/10 p-2 rounded-xl">
            <GraduationCap className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="font-black text-xl text-foreground hidden md:block">{exam.name}</h1>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{attempt.studentFirstName} {attempt.studentLastName}</p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className={cn(
            "flex items-center gap-3 px-6 py-2 rounded-2xl font-mono text-xl font-black transition-all duration-500 shadow-inner",
            timeLeft < 300 ? 'bg-red-500/10 text-red-500 animate-pulse border-2 border-red-500/20' : 'bg-muted/50 text-foreground'
          )}>
            <Timer className={cn("w-5 h-5", timeLeft < 300 ? "text-red-500" : "text-muted-foreground")} />
            {formatTime(timeLeft)}
          </div>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Button onClick={handleFinish} variant="destructive" className="font-black px-6 h-10 rounded-xl shadow-lg transition-all">
              Bitir
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto w-full p-6 flex-1 flex flex-col space-y-8">
        <div className="space-y-3 bg-card/30 p-6 rounded-[2rem] shadow-sm border border-border/50">
          <div className="flex justify-between items-end">
            <div className="space-y-1">
              <span className="text-xs font-black text-primary uppercase tracking-widest">Tərəqqi</span>
              <h2 className="text-2xl font-black text-foreground">Sual {currentIdx + 1} <span className="text-muted-foreground font-medium">/ {questions.length}</span></h2>
            </div>
            <span className="text-xl font-black text-primary bg-primary/10 px-4 py-1 rounded-full">{Math.round(progress)}%</span>
          </div>
          <Progress value={progress} className="h-4 rounded-full bg-muted" />
        </div>

        <Card className="shadow-2xl border border-border/50 rounded-[2.5rem] overflow-hidden bg-card/50 backdrop-blur-sm flex-1 flex flex-col">
          <CardHeader className="p-10 border-b border-border/50">
            <CardTitle className="text-3xl font-black leading-tight text-foreground">
              {currentQ.text}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-10 space-y-10 flex-1">
            {currentQ.image && (
              <div className="rounded-[2rem] border-8 border-muted/30 overflow-hidden bg-card shadow-2xl max-w-2xl mx-auto group">
                <img 
                  src={currentQ.image} 
                  alt="Sual şəkli" 
                  className="w-full h-auto transition-transform duration-500 group-hover:scale-105" 
                />
              </div>
            )}

            <div className="space-y-6">
              {currentQ.type === 'mcq' && (
                <RadioGroup 
                  value={attempt.answers?.[currentQ.id]?.finalAnswer || ''} 
                  onValueChange={(val) => updateAnswer(currentQ.id, val)}
                  className="grid grid-cols-1 md:grid-cols-2 gap-6"
                >
                  {(currentQ.options || []).map((opt: string, i: number) => {
                    const isSelected = attempt.answers?.[currentQ.id]?.finalAnswer === opt;
                    return (
                      <Label 
                        key={i} 
                        className={cn(
                          "flex items-center gap-6 p-6 rounded-3xl border-4 cursor-pointer transition-all duration-300 relative overflow-hidden group",
                          isSelected 
                            ? "border-primary bg-primary/10 shadow-xl scale-[1.02]" 
                            : "border-border/50 hover:border-primary/50 hover:bg-muted/30"
                        )}
                      >
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-black transition-colors shadow-sm",
                          isSelected ? "bg-primary text-white" : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                        )}>
                          {String.fromCharCode(65 + i)}
                        </div>
                        <span className="text-xl font-bold text-foreground flex-1">{opt}</span>
                        <RadioGroupItem value={opt} className="hidden" />
                      </Label>
                    );
                  })}
                </RadioGroup>
              )}

              {currentQ.type === 'open' && (
                <div className="max-w-xl mx-auto space-y-4">
                  <div className="p-8 bg-muted/20 rounded-[2rem] border-4 border-dashed border-border/50 space-y-4">
                    <Label className="text-xl font-black text-foreground block text-center">Cavabınızı daxil edin:</Label>
                    <Input 
                      className="h-20 text-3xl font-black text-center px-6 rounded-2xl border-none shadow-2xl focus:ring-primary bg-card text-foreground"
                      value={attempt.answers?.[currentQ.id]?.finalAnswer || ''}
                      onChange={(e) => updateAnswer(currentQ.id, e.target.value)}
                      placeholder="..."
                    />
                  </div>
                </div>
              )}

              {currentQ.type === 'explanation' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                  <div className="space-y-4">
                    <Label className="text-xl font-black text-foreground flex items-center gap-3">
                      <span className="bg-primary text-white w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-lg">1</span>
                      Ətraflı İzah
                    </Label>
                    <Textarea 
                      className="min-h-[350px] text-xl leading-relaxed rounded-[2rem] border-4 border-border/20 p-8 shadow-inner bg-muted/20 focus:bg-card focus:border-primary/40 transition-all text-foreground"
                      placeholder="Məsələnin həll yolunu və izahını ətraflı şəkildə bura yazın..."
                      value={attempt.answers?.[currentQ.id]?.explanation || ''}
                      onChange={(e) => updateAnswer(currentQ.id, attempt.answers?.[currentQ.id]?.finalAnswer || '', e.target.value)}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label className="text-xl font-black text-primary flex items-center gap-3">
                      <span className="bg-primary text-white w-10 h-10 rounded-2xl flex items-center justify-center text-lg shadow-lg">2</span>
                      Yekun Cavab
                    </Label>
                    <div className="p-10 bg-primary/5 rounded-[2.5rem] border-4 border-primary/10 shadow-inner flex flex-col items-center justify-center space-y-6">
                      <Input 
                        placeholder="Son cavab..."
                        className="h-20 bg-card text-3xl font-black text-center rounded-[1.5rem] border-none shadow-2xl focus:ring-primary w-full text-foreground"
                        value={attempt.answers?.[currentQ.id]?.finalAnswer || ''}
                        onChange={(e) => updateAnswer(currentQ.id, e.target.value, attempt.answers?.[currentQ.id]?.explanation)}
                      />
                      <div className="flex items-center gap-2 text-primary font-bold bg-primary/10 px-6 py-2 rounded-full">
                        <Sparkles className="w-5 h-5" />
                        <span className="text-sm">AI tərəfindən ballandırılacaq</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col md:flex-row justify-between items-center gap-6 pb-12">
          <Button 
            variant="outline" 
            size="lg" 
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(p => p - 1)}
            className="rounded-2xl h-16 px-10 border-2 font-black text-lg bg-card shadow-md hover:bg-muted"
          >
            <ChevronLeft className="w-6 h-6 mr-2" />
            Əvvəlki
          </Button>

          <div className="flex flex-wrap justify-center gap-3 bg-card/30 p-4 rounded-[2rem] backdrop-blur-sm border border-border/50">
            {questions.map((_: any, i: number) => {
              const isAnswered = !!attempt.answers?.[questions[i].id]?.finalAnswer;
              const isCurrent = i === currentIdx;
              return (
                <button
                  key={i}
                  onClick={() => setCurrentIdx(i)}
                  className={cn(
                    "w-12 h-12 rounded-2xl text-lg font-black transition-all duration-300 transform",
                    isCurrent 
                      ? "bg-primary text-white scale-125 shadow-xl z-10" 
                      : isAnswered 
                        ? "bg-primary/20 text-primary border-2 border-primary/20" 
                        : "bg-muted border-2 border-border/50 text-muted-foreground hover:border-primary/50"
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
            className="rounded-2xl h-16 px-10 font-black text-lg shadow-xl hover:translate-x-1 transition-all text-white"
          >
            Növbəti
            <ChevronRight className="w-6 h-6 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}