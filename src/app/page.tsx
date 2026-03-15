"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogIn, GraduationCap, Ticket, Loader2, Sparkles, Clock, DollarSign, MessageCircle } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query } from 'firebase/firestore';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { Badge } from '@/components/ui/badge';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function StudentEntry() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const activeExamsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'exams'));
  }, [firestore]);

  const { data: activeExams, isLoading: isExamsLoading } = useCollection(activeExamsQuery);

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

  const handleBuyBySms = (exam: any) => {
    const phoneNumber = "+994500000000"; 
    const message = `Salam, mən "${exam.name}" imtahanını almaq istəyirəm. Qiymət: ${exam.price} AZN.`;
    window.location.href = `sms:${phoneNumber}?body=${encodeURIComponent(message)}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-6 relative overflow-hidden space-y-12">
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px]" />

      <header className="w-full max-w-6xl flex justify-between items-center z-20">
        <div className="flex items-center gap-2">
          <GraduationCap className="w-8 h-8 text-primary" />
          <span className="font-black text-xl tracking-tight">Imtahan<span className="text-primary">Flow</span></span>
        </div>
        <ThemeToggle />
      </header>

      <div className="w-full max-w-6xl mt-4 space-y-16 relative z-10">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-4 bg-card shadow-2xl rounded-3xl mb-2 animate-bounce border border-border/50">
            <GraduationCap className="w-12 h-12 text-primary" />
          </div>
          <div className="space-y-1">
            <h1 className="text-5xl font-black tracking-tight text-foreground flex items-center justify-center gap-2">
              Biliyini<span className="text-primary">Yoxla</span>
              <Sparkles className="w-6 h-6 text-yellow-500" />
            </h1>
            <p className="text-muted-foreground font-medium text-lg">Onlayn imtahan platformasına xoş gəlmisiniz</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
          <div className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-2xl font-black text-foreground flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Aktiv İmtahanlar
              </h2>
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black">
                Yeni
              </Badge>
            </div>

            {isExamsLoading ? (
              <div className="h-64 flex items-center justify-center bg-card/30 rounded-[2rem] border border-dashed border-border/50">
                <Loader2 className="w-8 h-8 animate-spin text-primary/50" />
              </div>
            ) : activeExams && activeExams.length > 0 ? (
              <Carousel className="w-full">
                <CarouselContent>
                  {activeExams.map((exam: any) => (
                    <CarouselItem key={exam.id} className="md:basis-full lg:basis-full">
                      <Card className="border-none shadow-xl bg-card/50 backdrop-blur-xl rounded-[2.5rem] overflow-hidden group hover:ring-2 ring-primary/20 transition-all">
                        <CardContent className="p-8 space-y-6">
                          <div className="space-y-2">
                            <h3 className="text-3xl font-black text-foreground group-hover:text-primary transition-colors">{exam.name}</h3>
                            <p className="text-muted-foreground font-medium">Bu imtahana qoşularaq biliyinizi yoxlayın.</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div className="bg-muted/30 p-4 rounded-2xl flex items-center gap-3">
                              <div className="bg-primary/10 p-2 rounded-xl">
                                <Clock className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Müddət</p>
                                <p className="text-sm font-bold">{exam.durationMinutes} dəq</p>
                              </div>
                            </div>
                            <div className="bg-primary/10 p-4 rounded-2xl flex items-center gap-3">
                              <div className="bg-primary/20 p-2 rounded-xl">
                                <DollarSign className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest">Qiymət</p>
                                <p className="text-sm font-bold text-primary">{exam.price} AZN</p>
                              </div>
                            </div>
                          </div>

                          <Button 
                            className="w-full h-14 rounded-2xl font-black text-lg bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 gap-3"
                            onClick={() => handleBuyBySms(exam)}
                          >
                            <MessageCircle className="w-6 h-6" />
                            İndi Al (SMS)
                          </Button>
                        </CardContent>
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <div className="hidden sm:block">
                  <CarouselPrevious className="-left-4 bg-card/80 border-border/50 hover:bg-primary hover:text-white transition-colors" />
                  <CarouselNext className="-right-4 bg-card/80 border-border/50 hover:bg-primary hover:text-white transition-colors" />
                </div>
              </Carousel>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center bg-card/30 rounded-[2rem] border border-dashed border-border/50 text-muted-foreground">
                <p className="font-bold">Hazırda aktiv imtahan yoxdur.</p>
              </div>
            )}
          </div>

          <div className="space-y-6">
            <h2 className="text-2xl font-black text-foreground px-2 flex items-center gap-2">
              <Ticket className="w-5 h-5 text-primary" />
              Sessiyaya Giriş
            </h2>
            <Card className="border border-border/50 shadow-2xl bg-card/50 backdrop-blur-xl rounded-[2.5rem] overflow-hidden">
              <CardContent className="space-y-6 p-10">
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
                  className="w-full h-14 text-lg font-black rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all duration-300 active:scale-[0.98] bg-primary text-white" 
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
          </div>
        </div>
        
        <p className="text-center text-muted-foreground/50 text-sm font-medium pb-8">
          &copy; {new Date().getFullYear()} ImtahanFlow. Bütün hüquqlar qorunur.
        </p>
      </div>
    </div>
  );
}