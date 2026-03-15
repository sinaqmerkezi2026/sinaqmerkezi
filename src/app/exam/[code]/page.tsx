
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Timer, ChevronRight, ChevronLeft, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

  // Memoize the attempt reference
  const attemptRef = useMemoFirebase(() => 
    attemptId ? doc(firestore, 'studentAttempts', attemptId) : null, 
    [firestore, attemptId]
  );
  const { data: attempt, isLoading: isAttemptLoading } = useDoc(attemptRef);

  // Memoize the exam reference based on attempt data
  const examRef = useMemoFirebase(() => 
    attempt?.examId ? doc(firestore, 'exams', attempt.examId) : null,
    [firestore, attempt?.examId]
  );
  const { data: exam, isLoading: isExamLoading } = useDoc(examRef);

  // Handle Redirection logic more robustly
  useEffect(() => {
    // Wait until loading is finished and attemptId is present
    if (attemptId && !isAttemptLoading) {
      if (!attempt) {
        // Only redirect if loading finished and no attempt was found
        const timer = setTimeout(() => router.push('/'), 2000);
        return () => clearTimeout(timer);
      }
      
      if (attempt.endTime) {
        // Redirect if exam is already finished
        router.push(`/results/${code}`);
      }
      
      setHasCheckedStatus(true);
    }
  }, [attempt, isAttemptLoading, attemptId, router, code]);

  // Handle Timer
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
    return () => clearInterval(timer);
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
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Giriş xətası</AlertTitle>
          <AlertDescription>
            İmtahan ID-si tapılmadı. Zəhmət olmasa yenidən giriş edin.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isAttemptLoading || !hasCheckedStatus) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-slate-500 font-medium">Sessiya yüklənir...</p>
        </div>
      </div>
    );
  }

  if (!attempt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto" />
          <h2 className="text-xl font-bold">Sessiya tapılmadı</h2>
          <p className="text-slate-500">Giriş məlumatlarınız yanlışdır və ya sessiya silinib.</p>
          <Button onClick={() => router.push('/')}>Geri qayıt</Button>
        </div>
      </div>
    );
  }

  if (isExamLoading || !exam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" />
          <p className="text-slate-500 font-medium">İmtahan sualları yüklənir...</p>
        </div>
      </div>
    );
  }

  const questions = exam.questions || [];
  const currentQ = questions[currentIdx];
  const progress = questions.length > 0 ? ((currentIdx + 1) / questions.length) * 100 : 0;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-6">
        <div className="text-center space-y-4">
          <h2 className="text-xl font-bold">Sual tapılmadı</h2>
          <p className="text-slate-500">Bu imtahanda hələ sual əlavə edilməyib.</p>
          <Button onClick={() => router.push('/')}>Geri qayıt</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10 shadow-sm">
        <div>
          <h1 className="font-bold text-lg hidden sm:block text-slate-800">{exam.name}</h1>
          <p className="text-sm text-muted-foreground">{attempt.studentFirstName} {attempt.studentLastName}</p>
        </div>
        <div className={`flex items-center gap-2 px-6 py-2 rounded-full font-mono text-xl font-bold transition-colors ${timeLeft < 300 ? 'bg-red-100 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
          <Timer className="w-5 h-5" />
          {formatTime(timeLeft)}
        </div>
        <Button onClick={handleFinish} variant="destructive" className="font-bold px-6">
          İmtahanı Bitir
        </Button>
      </header>

      <div className="max-w-4xl mx-auto w-full p-6 flex-1 space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-bold text-slate-600">
            <span>Sual {currentIdx + 1} / {questions.length}</span>
            <span>{Math.round(progress)}% tamamlandı</span>
          </div>
          <Progress value={progress} className="h-3 rounded-full" />
        </div>

        <Card className="shadow-xl border-none overflow-hidden transition-all duration-300">
          <CardHeader className="bg-white border-b pb-8">
            <CardTitle className="text-2xl leading-relaxed text-slate-800 font-bold">{currentQ.text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-8 pt-8">
            {currentQ.image && (
              <div className="rounded-xl border-2 border-slate-100 overflow-hidden bg-white shadow-inner">
                <img src={currentQ.image} alt="Sual şəkli" className="max-w-full h-auto mx-auto block" />
              </div>
            )}

            {currentQ.type === 'mcq' && (
              <RadioGroup 
                value={attempt.answers?.[currentQ.id]?.finalAnswer || ''} 
                onValueChange={(val) => updateAnswer(currentQ.id, val)}
                className="grid gap-4"
              >
                {(currentQ.options || []).map((opt: string, i: number) => (
                  <Label key={i} className={`flex items-center gap-4 p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 ${attempt.answers?.[currentQ.id]?.finalAnswer === opt ? 'border-primary bg-primary/5 shadow-md scale-[1.01]' : 'border-slate-100 hover:border-slate-300 hover:bg-slate-50'}`}>
                    <RadioGroupItem value={opt} className="w-5 h-5" />
                    <span className="text-xl font-medium text-slate-700">{String.fromCharCode(65 + i)}) {opt}</span>
                  </Label>
                ))}
              </RadioGroup>
            )}

            {currentQ.type === 'open' && (
              <div className="space-y-4">
                <Label className="text-lg font-bold text-slate-700">Cavabınız:</Label>
                <Input 
                  className="h-16 text-xl px-6 rounded-2xl border-2 focus:ring-primary shadow-sm"
                  value={attempt.answers?.[currentQ.id]?.finalAnswer || ''}
                  onChange={(e) => updateAnswer(currentQ.id, e.target.value)}
                  placeholder="Bura yazın..."
                />
              </div>
            )}

            {currentQ.type === 'explanation' && (
              <div className="space-y-8">
                <div className="space-y-3">
                  <Label className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Həlli və İzahı:
                  </Label>
                  <Textarea 
                    className="min-h-[250px] text-lg leading-relaxed rounded-2xl border-2 p-6 shadow-sm focus:ring-primary"
                    placeholder="Məsələnin həll yolunu və izahını ətraflı şəkildə bura yazın..."
                    value={attempt.answers?.[currentQ.id]?.explanation || ''}
                    onChange={(e) => updateAnswer(currentQ.id, attempt.answers?.[currentQ.id]?.finalAnswer || '', e.target.value)}
                  />
                </div>
                <div className="space-y-3 p-6 bg-primary/5 rounded-2xl border-2 border-primary/20 shadow-inner">
                  <Label className="text-lg font-bold text-primary flex items-center gap-2">
                    <span className="bg-primary text-white w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Son Cavab:
                  </Label>
                  <Input 
                    placeholder="Yalnız son cavabı bura yazın..."
                    className="h-14 bg-white text-lg rounded-xl border-none shadow-sm"
                    value={attempt.answers?.[currentQ.id]?.finalAnswer || ''}
                    onChange={(e) => updateAnswer(currentQ.id, e.target.value, attempt.answers?.[currentQ.id]?.explanation)}
                  />
                  <p className="text-xs text-slate-500 mt-2 font-medium">Qeyd: İzahınız AI tərəfindən ballandırılacaq.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between items-center gap-4 pt-6 pb-12">
          <Button 
            variant="outline" 
            size="lg" 
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(p => p - 1)}
            className="rounded-xl h-14 px-8 border-2 font-bold"
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Əvvəlki
          </Button>

          <div className="hidden md:flex gap-2">
            {questions.map((_: any, i: number) => (
              <button
                key={i}
                onClick={() => setCurrentIdx(i)}
                className={`w-12 h-12 rounded-xl text-sm font-bold transition-all duration-200 border-2 ${i === currentIdx ? 'bg-primary border-primary text-white scale-110 shadow-lg' : attempt.answers?.[questions[i].id] ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-white border-slate-200 text-slate-400 hover:border-slate-400'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <Button 
            size="lg"
            disabled={currentIdx === questions.length - 1}
            onClick={() => setCurrentIdx(p => p + 1)}
            className="rounded-xl h-14 px-8 font-bold shadow-lg"
          >
            Növbəti
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}
