"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { db } from '@/lib/store';
import { useToast } from '@/hooks/use-toast';
import { LogIn, GraduationCap, Ticket } from 'lucide-react';

export default function StudentEntry() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleEnter = () => {
    if (!code || !name || !surname) {
      toast({ title: 'Xəta', description: 'Zəhmət olmasa bütün xanaları doldurun.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    const exam = db.getExamByCode(code);

    if (!exam) {
      toast({ title: 'Xəta', description: 'Daxil etdiyiniz kod yanlışdır.', variant: 'destructive' });
      setIsLoading(false);
      return;
    }

    const attempt = db.getAttemptByCode(code);
    
    // If exam is already finished with this code
    if (attempt && attempt.endTime) {
      router.push(`/results/${code}`);
      return;
    }

    // If starting fresh or resuming
    if (!attempt) {
      const newAttempt = {
        id: Math.random().toString(36).substr(2, 9),
        examId: exam.id,
        code: code,
        studentName: name,
        studentSurname: surname,
        answers: {},
        startTime: Date.now(),
      };
      db.saveAttempt(newAttempt);
    }

    router.push(`/exam/${code}`);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <GraduationCap className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground">ImtahanFlow</h1>
          <p className="text-muted-foreground">Onlayn imtahan platformasına xoş gəlmisiniz</p>
        </div>

        <Card className="border-none shadow-xl bg-white/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <LogIn className="w-5 h-5 text-primary" />
              Giriş
            </CardTitle>
            <CardDescription>
              İmtahana başlamaq üçün sizə təqdim olunan kodu və məlumatlarınızı daxil edin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">İmtahan Kodu</Label>
              <div className="relative">
                <Ticket className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input 
                  id="code" 
                  placeholder="Məs: A7B2C9" 
                  className="pl-10 uppercase font-mono tracking-widest"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Ad</Label>
                <Input 
                  id="name" 
                  placeholder="Adınız" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surname">Soyad</Label>
                <Input 
                  id="surname" 
                  placeholder="Soyadınız" 
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                />
              </div>
            </div>
            <Button 
              className="w-full h-11 text-lg font-medium shadow-lg hover:shadow-primary/20 transition-all" 
              onClick={handleEnter}
              disabled={isLoading}
            >
              {isLoading ? 'Giriş edilir...' : 'İmtahana başla'}
            </Button>
          </CardContent>
        </Card>

        <div className="text-center text-sm">
          <p className="text-muted-foreground">
            İmtahan kodunuz yoxdur? {' '}
            <button 
              onClick={() => window.open('https://wa.me/994514262676?text=Imtahan%20üçün%20bilet%20almaq%20istəyirəm', '_blank')}
              className="text-primary font-semibold hover:underline"
            >
              Buradan əldə edin
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}