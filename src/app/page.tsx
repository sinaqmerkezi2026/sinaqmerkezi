
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogIn, GraduationCap, Ticket, Loader2 } from 'lucide-react';
import { useFirestore, useAuth, initiateAnonymousSignIn } from '@/firebase';
import { collectionGroup, query, where, getDocs, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export default function StudentEntry() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const auth = useAuth();

  const handleEnter = async () => {
    if (!code || !name || !surname) {
      toast({ title: 'Xəta', description: 'Zəhmət olmasa bütün xanaları doldurun.', variant: 'destructive' });
      return;
    }

    setIsLoading(true);

    try {
      // 1. Sign in anonymously
      initiateAnonymousSignIn(auth);

      // 2. Search for the access code across all exams
      // Note: This requires a Collection Group Index in Firestore for 'accessCodes'
      const codesRef = collectionGroup(firestore, 'accessCodes');
      const q = query(codesRef, where('code', '==', code.toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        toast({ title: 'Xəta', description: 'Daxil etdiyiniz kod yanlışdır.', variant: 'destructive' });
        setIsLoading(false);
        return;
      }

      const codeDoc = querySnapshot.docs[0];
      const codeData = codeDoc.data();

      if (codeData.isUsedForEntry) {
        // If used, redirect to results (if the student matches or logic permits)
        router.push(`/results/${code.toUpperCase()}`);
        return;
      }

      // 3. Create a new StudentAttempt
      const attemptId = Math.random().toString(36).substr(2, 9);
      const attemptRef = doc(firestore, 'studentAttempts', attemptId);
      
      const newAttempt = {
        id: attemptId,
        examId: codeData.examId,
        examAccessCodeId: codeDoc.id,
        studentFirstName: name,
        studentLastName: surname,
        startTime: new Date().toISOString(),
        isCompleted: false,
        studentAuthUid: auth.currentUser?.uid || 'anon', // Best effort
      };

      await setDoc(attemptRef, newAttempt);

      // 4. Mark code as used
      await setDoc(codeDoc.ref, { 
        isUsedForEntry: true, 
        studentAttemptId: attemptId 
      }, { merge: true });

      toast({ title: 'Uğurlu', description: 'İmtahan başladı!' });
      router.push(`/exam/${code.toUpperCase()}?attemptId=${attemptId}`);
      
    } catch (error: any) {
      console.error(error);
      toast({ title: 'Sistem xətası', description: 'Firestore ilə əlaqə qurula bilmədi. İndeks yoxlanılmalıdır.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
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
              Bazadakı aktiv kodunuzu və məlumatlarınızı daxil edin.
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
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Yoxlanılır...
                </>
              ) : 'İmtahana başla'}
            </Button>
          </CardContent>
        </Card>

        <div className="text-center text-sm">
          <p className="text-muted-foreground">
            İmtahan kodunuz yoxdur? {' '}
            <button 
              onClick={() => window.open('https://wa.me/994514262676', '_blank')}
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
