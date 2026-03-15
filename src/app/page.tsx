
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
    <div className="min-h-screen bg-[#f8fafc] flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[100px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[100px]" />

      <div className="w-full max-w-md space-y-8 relative z-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-white shadow-xl rounded-3xl mb-2 animate-bounce">
            <GraduationCap className="w-12 h-12 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-5xl font-black tracking-tight text-slate-900 flex items-center justify-center gap-2">
              Imtahan<span className="text-primary">Flow</span>
              <Sparkles className="w-6 h-6 text-yellow-500" />
            </h1>
            <p className="text-slate-500 font-medium text-lg">Onlayn imtahan platformasına xoş gəlmisiniz</p>
          </div>
        </div>

        <Card className="border-none shadow-2xl bg-white/80 backdrop-blur-sm rounded-[2rem] overflow-hidden">
          <CardHeader className="pt-8 px-8">
            <CardTitle className="text-2xl font-bold flex items-center gap-3 text-slate-800">
              <LogIn className="w-6 h-6 text-primary" />
              Sessiyaya Giriş
            </CardTitle>
            <CardDescription className="text-slate-500 font-medium">
              İmtahan kodunuzu və şəxsi məlumatlarınızı daxil edin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 p-8">
            <div className="space-y-2">
              <Label htmlFor="code" className="text-sm font-bold text-slate-600">İmtahan Kodu</Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Ticket className="h-5 w-5 text-slate-400 group-focus-within:text-primary transition-colors" />
                </div>
                <Input 
                  id="code" 
                  placeholder="MƏS: A7B2C9" 
                  className="pl-12 uppercase font-mono tracking-[0.3em] text-xl h-14 rounded-2xl border-2 border-slate-100 focus:border-primary focus:ring-primary/20 transition-all bg-slate-50/50"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-bold text-slate-600">Ad</Label>
                <Input 
                  id="name" 
                  placeholder="Adınız" 
                  className="h-12 rounded-xl border-2 border-slate-100 focus:border-primary bg-slate-50/50"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surname" className="text-sm font-bold text-slate-600">Soyad</Label>
                <Input 
                  id="surname" 
                  placeholder="Soyadınız" 
                  className="h-12 rounded-xl border-2 border-slate-100 focus:border-primary bg-slate-50/50"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                />
              </div>
            </div>

            <Button 
              className="w-full h-14 text-lg font-bold rounded-2xl shadow-[0_10px_20px_-5px_rgba(var(--primary),0.3)] hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98]" 
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
        
        <p className="text-center text-slate-400 text-sm font-medium">
          &copy; {new Date().getFullYear()} ImtahanFlow. Bütün hüquqlar qorunur.
        </p>
      </div>
    </div>
  );
}
