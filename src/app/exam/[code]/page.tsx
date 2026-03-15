"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { db, Exam, Attempt } from '@/lib/store';
import { Timer, Send, ChevronRight, ChevronLeft, Flag } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';

export default function ExamSession() {
  const { code } = useParams();
  const router = useRouter();
  const { toast } = useToast();

  const [exam, setExam] = useState<Exam | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const e = db.getExamByCode(code as string);
    const a = db.getAttemptByCode(code as string);

    if (!e || !a || a.endTime) {
      router.push('/');
      return;
    }

    setExam(e);
    setAttempt(a);

    const elapsed = Math.floor((Date.now() - a.startTime) / 1000);
    const totalSeconds = e.durationMinutes * 60;
    const remaining = Math.max(0, totalSeconds - elapsed);
    setTimeLeft(remaining);

    if (remaining <= 0) handleFinish();
  }, [code, router]);

  useEffect(() => {
    if (timeLeft <= 0) return;
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
  }, [timeLeft]);

  const updateAnswer = (qId: string, finalAnswer: string, explanation?: string) => {
    if (!attempt) return;
    const newAnswers = {
      ...attempt.answers,
      [qId]: { finalAnswer, explanation }
    };
    const updated = { ...attempt, answers: newAnswers };
    setAttempt(updated);
    db.saveAttempt(updated);
  };

  const handleFinish = async () => {
    if (isSubmitting || !attempt) return;
    setIsSubmitting(true);
    
    const finalAttempt = { ...attempt, endTime: Date.now() };
    db.saveAttempt(finalAttempt);
    
    toast({ title: 'İmtahan bitdi', description: 'Nəticələriniz hesablanır...' });
    router.push(`/results/${code}`);
  };

  if (!exam || !attempt) return null;

  const currentQ = exam.questions[currentIdx];
  const progress = ((currentIdx + 1) / exam.questions.length) * 100;

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-white border-b px-6 py-4 flex justify-between items-center sticky top-0 z-10">
        <div>
          <h1 className="font-bold text-lg hidden sm:block">{exam.name}</h1>
          <p className="text-sm text-muted-foreground">{attempt.studentName} {attempt.studentSurname}</p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-full font-mono text-xl font-bold ${timeLeft < 300 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-700'}`}>
          <Timer className="w-5 h-5" />
          {formatTime(timeLeft)}
        </div>
        <Button onClick={handleFinish} variant="destructive">
          Bitir
        </Button>
      </header>

      <div className="max-w-4xl mx-auto w-full p-6 flex-1 space-y-6">
        <div className="space-y-2">
          <div className="flex justify-between text-sm font-medium">
            <span>Sual {currentIdx + 1} / {exam.questions.length}</span>
            <span>{Math.round(progress)}% tamamlandı</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        <Card className="shadow-lg border-none">
          <CardHeader>
            <CardTitle className="text-xl leading-relaxed">{currentQ.text}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {currentQ.image && (
              <div className="rounded-lg border overflow-hidden bg-white">
                <img src={currentQ.image} alt="Sual şəkli" className="max-w-full h-auto mx-auto" />
              </div>
            )}

            {currentQ.type === 'mcq' && (
              <RadioGroup 
                value={attempt.answers[currentQ.id]?.finalAnswer || ''} 
                onValueChange={(val) => updateAnswer(currentQ.id, val)}
                className="grid gap-3"
              >
                {currentQ.options?.map((opt, i) => (
                  <Label key={i} className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${attempt.answers[currentQ.id]?.finalAnswer === opt ? 'border-primary bg-primary/5' : 'hover:border-slate-300'}`}>
                    <RadioGroupItem value={opt} />
                    <span className="text-lg">{opt}</span>
                  </Label>
                ))}
              </RadioGroup>
            )}

            {currentQ.type === 'open' && (
              <div className="space-y-4">
                <Label className="text-lg">Cavabınız:</Label>
                <Input 
                  className="h-14 text-lg"
                  value={attempt.answers[currentQ.id]?.finalAnswer || ''}
                  onChange={(e) => updateAnswer(currentQ.id, e.target.value)}
                  placeholder="Bura yazın..."
                />
              </div>
            )}

            {currentQ.type === 'explanation' && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label className="text-lg font-bold">Həlli və İzahı:</Label>
                  <Textarea 
                    className="min-h-[200px] text-lg leading-relaxed"
                    placeholder="Məsələnin həll yolunu və izahını ətraflı şəkildə bura yazın..."
                    value={attempt.answers[currentQ.id]?.explanation || ''}
                    onChange={(e) => updateAnswer(currentQ.id, attempt.answers[currentQ.id]?.finalAnswer || '', e.target.value)}
                  />
                </div>
                <div className="space-y-2 p-4 bg-primary/5 rounded-xl border border-primary/10">
                  <Label className="text-lg font-bold">Son Cavab:</Label>
                  <Input 
                    placeholder="Son cavabı bura yazın..."
                    className="bg-white"
                    value={attempt.answers[currentQ.id]?.finalAnswer || ''}
                    onChange={(e) => updateAnswer(currentQ.id, e.target.value, attempt.answers[currentQ.id]?.explanation)}
                  />
                  <p className="text-xs text-muted-foreground mt-1">İzahınız AI tərəfindən, son cavabınız isə sistem tərəfindən yoxlanılacaq.</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="flex justify-between gap-4 pt-4">
          <Button 
            variant="outline" 
            size="lg" 
            disabled={currentIdx === 0}
            onClick={() => setCurrentIdx(p => p - 1)}
          >
            <ChevronLeft className="w-5 h-5 mr-2" />
            Əvvəlki
          </Button>

          <div className="flex gap-2">
            {exam.questions.map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentIdx(i)}
                className={`w-10 h-10 rounded-full text-sm font-medium transition-all ${i === currentIdx ? 'bg-primary text-white scale-110 shadow-lg' : attempt.answers[exam.questions[i].id] ? 'bg-primary/20 text-primary' : 'bg-slate-200 text-slate-500'}`}
              >
                {i + 1}
              </button>
            ))}
          </div>

          <Button 
            size="lg"
            disabled={currentIdx === exam.questions.length - 1}
            onClick={() => setCurrentIdx(p => p + 1)}
          >
            Növbəti
            <ChevronRight className="w-5 h-5 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  );
}