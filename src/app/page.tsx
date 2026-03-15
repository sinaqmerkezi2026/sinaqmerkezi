
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogIn, GraduationCap, Ticket, Loader2 } from 'lucide-react';
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
      // Lookup code directly from the flat accessCodes collection using the code as Document ID
      const codeRef = doc(firestore, 'accessCodes', cleanCode);
      const codeSnap = await getDoc(codeRef);

      if (!codeSnap.exists()) {
        toast({ title: 'Xəta', description: 'Daxil etdiyiniz kod yanlışdır.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const codeData = codeSnap.data();

      // If already used, go straight to results
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

      // Create student attempt document
      await setDoc(attemptRef, newAttempt);

      // Mark code as used and link to attempt
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
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-2xl mb-4">
            <GraduationCap className="w-10 h-10 text-primary" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900">ImtahanFlow</h1>
          <p className="text-slate-500">Onlayn imtahan platformasına xoş gəlmisiniz</p>
        </div>

        <Card className="border-none shadow-xl bg-white">
          <CardHeader>
            <CardTitle className="text-xl font-semibold flex items-center gap-2">
              <LogIn className="w-5 h-5 text-primary" />
              Giriş
            </CardTitle>
            <CardDescription>
              İmtahan kodunuzu və məlumatlarınızı daxil edin.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">İmtahan Kodu</Label>
              <div className="relative">
                <Ticket className="absolute left-3 top-3 w-4 h-4 text-slate-400" />
                <Input 
                  id="code" 
                  placeholder="Məs: A7B2C9" 
                  className="pl-10 uppercase font-mono tracking-widest text-lg h-12"
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
                  className="h-11"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surname">Soyad</Label>
                <Input 
                  id="surname" 
                  placeholder="Soyadınız" 
                  className="h-11"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                />
              </div>
            </div>
            <Button 
              className="w-full h-12 text-lg font-medium shadow-lg transition-all" 
              onClick={handleEnter}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Yoxlanılır...
                </>
              ) : 'İmtahana başla'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
