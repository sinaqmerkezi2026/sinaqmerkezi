"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogIn, GraduationCap, Ticket, Loader2, Sparkles } from 'lucide-react';
import { useFirestore } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';

export default function StudentEntry() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const handleEnter = async () => {
    const cleanCode = code.trim().toUpperCase();
    const cleanName = name.trim();
    const cleanSurname = surname.trim();

    if (!cleanCode || !cleanName || !cleanSurname) {
      toast({ title: 'Xəta', description: 'Zəhmət olmasa bütün xanaları doldurun.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);

    try {
      const codeRef = doc(firestore, 'accessCodes', cleanCode);
      const codeSnap = await getDoc(codeRef);

      if (!codeSnap.exists()) {
        toast({ title: 'Xəta', description: 'Daxil etdiyiniz kod yanlışdır.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const codeData = codeSnap.data();

      if (codeData.isUsedForEntry) {
        toast({ title: 'Məlumat', description: 'Bu kod artıq istifadə edilib. Nəticələrə yönləndirilirsiniz...' });
        router.push(`/results/${cleanCode}`);
        return;
      }

      const attemptId = Math.random().toString(36).substr(2, 9);
      const attemptRef = doc(firestore, 'studentAttempts', attemptId);
      
      const newAttempt = {
        id: attemptId,
        examId: codeData.examId,
        examAccessCode: cleanCode,
        studentFirstName: cleanName,
        studentLastName: cleanSurname,
        startTime: Date.now(),
        isCompleted: false,
        answers: {}
      };

      await setDoc(attemptRef, newAttempt);

      await updateDoc(codeRef, { 
        isUsedForEntry: true, 
        studentAttemptId: attemptId 
      });

      toast({ title: 'Uğurlu', description: 'İmtahan başladı!' });
      router.push(`/exam/${cleanCode}?attemptId=${attemptId}`);
      
    } catch (error: any) {
      console.error("Entry Error:", error);
      toast({ title: 'Sistem xətası', description: error.message || 'Məlumat bazası ilə əlaqə xətası.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-card shadow-2xl rounded-3xl mb-2 animate-bounce border border-border/50">
            <GraduationCap className="w-12 h-12 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-5xl font-black tracking-tight text-foreground flex items-center justify-center gap-2">
              Imtahan<span className="text-primary">Flow</span>
              <Sparkles className="w-6 h-6 text-yellow-500" />
            </h1>
            <p className="text-muted-foreground font-medium text-lg">Onlayn imtahan platformasına xoş gəlmisiniz</p>
          </div>
        </div>

        <Card className="border border-border/50 shadow-2xl bg-card/50 backdrop-blur-xl rounded-[2rem] overflow-hidden">
          <CardHeader className="pt-8 px-8">
            <CardTitle className="text-2xl font-bold flex items-center gap-3 text-foreground">
              <LogIn className="w-6 h-6 text-primary" />
              Sessiyaya Giriş
            </CardTitle>
            <CardDescription className="text-muted-foreground font-medium">
              İmtahan kodunuzu və şəxsi məlumatlarınızı daxil edin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-8">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-bold text-muted-foreground">İmtahan Kodu</Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Ticket className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input 
                  id="code" 
                  placeholder="MƏS: A7B2C9" 
                  className="pl-12 uppercase font-mono tracking-[0.3em] text-xl h-14 rounded-2xl border-2 border-border/50 focus:border-primary focus:ring-primary/20 transition-all bg-muted/20 text-foreground"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-bold text-muted-foreground">Ad</Label>
                <Input 
                  id="name" 
                  placeholder="Adınız" 
                  className="h-12 rounded-xl border-2 border-border/50 focus:border-primary bg-muted/20 text-foreground"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surname" className="text-sm font-bold text-muted-foreground">Soyad</Label>
                <Input 
                  id="surname" 
                  placeholder="Soyadınız" 
                  className="h-12 rounded-xl border-2 border-border/50 focus:border-primary bg-muted/20 text-foreground"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                />
              </div>
            </div>

            <Button 
              className="w-full h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98]" 
              onClick={handleEnter}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                  Giriş edilir...
                </>
              ) : 'İmtahana Başla'}
            </Button>
          </CardContent>
        </Card>
        
        <p className="text-center text-muted-foreground/50 text-sm font-medium">
          &copy; {new Date().getFullYear()} ImtahanFlow. Bütün hüquqlar qorunur.
        </p>
      </div>
    </div>
  );
}