"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogIn, GraduationCap, Ticket, Loader2, Sparkles, Clock, DollarSign, Send, Trophy, Heart, Info } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

  const handleBuyByTelegram = (exam: any) => {
    const telegramUsername = "SinaqMerkeziAdmin"; 
    const message = encodeURIComponent(`Salam, mən "${exam.name}" imtahanı üçün giriş kodu almaq istəyirəm. Qiymət: ${exam.price} AZN.`);
    const url = `https://t.me/${telegramUsername}?text=${message}`;
    window.open(url, '_blank');
  };

  const handleSupport = () => {
    const telegramUsername = "SinaqMerkeziAdmin";
    const message = encodeURIComponent("Sizə dəstək olmaq istəyirəm");
    const url = `https://t.me/${telegramUsername}?text=${message}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-6 relative overflow-hidden">
      {/* Dynamic Background Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/20 rounded-full blur-[120px] animate-pulse pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/10 rounded-full blur-[120px] animate-pulse pointer-events-none delay-1000" />
      <div className="absolute top-[40%] left-[20%] w-[30%] h-[30%] bg-purple-500/10 rounded-full blur-[100px] animate-pulse pointer-events-none delay-500" />

      <header className="w-full max-w-6xl flex justify-between items-center z-50 py-4 px-4 bg-background/20 backdrop-blur-xl rounded-3xl border border-white/10 mt-2 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-2xl shadow-lg shadow-primary/20">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="font-black text-2xl tracking-tight text-foreground">Sınaq<span className="text-primary">Mərkəzi</span></span>
        </div>
        <div className="flex items-center gap-2 sm:gap-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="ghost" className="font-bold gap-2 text-foreground/70 hover:bg-primary/10 hover:text-primary rounded-xl">
                <Info className="w-5 h-5" />
                <span className="hidden sm:inline">Haqqımızda</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl rounded-[2.5rem] bg-card/90 backdrop-blur-3xl border-white/10 shadow-3xl">
              <DialogHeader className="p-4">
                <DialogTitle className="text-3xl font-black tracking-tight flex items-center gap-3">
                  <Info className="w-8 h-8 text-primary" />
                  Platforma Haqqında
                </DialogTitle>
              </DialogHeader>
              <div className="p-6 space-y-6 text-lg font-medium leading-relaxed text-foreground/80">
                <p>
                  Bu platforma buraxılış və blok imtahanlarına hazırlaşan abituriyentlər üçün nəzərdə tutulmuşdur. Burada istifadəçilər müxtəlif imtahan biletləri vasitəsilə öz biliklərini yoxlaya və imtahan mühitinə daha yaxşı hazırlaşa biləər.
                </p>
                <p>
                  Platformada yalnız abituriyentlər deyil, həmçinin müxtəlif siniflər üzrə biliklərini təkmilləşdirmək istəyən şagirdlər də iştirak edə bilərlər. İmtahan bileti almaq üçün müvafiq linklərə klik etməyiniz kifayətdir. Müraciət etdikdən sonra sizinlə əlaqə saxlanılacaq və imtahan bileti ilə bağlı məlumat veriləcək.
                </p>
                <p>
                  Saytda promo kod sistemi də mövcuddur. Əgər promo kodunuz varsa, ondan istifadə edərək xüsusi endirimlər qazana bilərsiniz. Endirim faizi imtahan nəticələrinə əsasən təyin olunur və daha yüksək nəticə əldə edən istifadəçilər daha böyük endirim imkanlarından yararlana bilərlər.
                </p>
                <p>
                  Əlavə dəstək göstərmək və ya layihənin inkişafına töhfə vermək istəyirsinizsə, bunu da edə bilərsiniz. Təşəkkür edirik!
                </p>
              </div>
            </DialogContent>
          </Dialog>

          <Button 
            variant="ghost" 
            className="font-bold gap-2 text-red-500 hover:bg-red-500/10 rounded-xl"
            onClick={handleSupport}
          >
            <Heart className="w-5 h-5 fill-current" />
            <span className="hidden sm:inline">Dəstək</span>
          </Button>
          <Button 
            variant="ghost" 
            className="font-bold gap-2 text-primary hover:bg-primary/10 rounded-xl"
            onClick={() => router.push('/ranking')}
          >
            <Trophy className="w-5 h-5" />
            <span className="hidden sm:inline">Liderlər</span>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="w-full max-w-6xl mt-12 space-y-20 relative z-10 flex-1">
        <div className="text-center space-y-6">
          <div className="space-y-4">
            <h1 className="text-6xl md:text-8xl font-black tracking-tight text-foreground leading-[0.9]">
              Biliyini<br /><span className="text-primary relative inline-block">Yoxla
                <Sparkles className="w-8 h-8 text-yellow-500 absolute -top-4 -right-8 animate-pulse" />
              </span>
            </h1>
            <p className="text-muted-foreground font-semibold text-xl md:text-2xl max-w-2xl mx-auto leading-relaxed">
              Azərbaycanın ən müasir AI dəstəkli onlayn imtahan platforması.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start pb-20">
          <div className="space-y-8">
            <div className="flex items-center justify-between px-2">
              <h2 className="text-3xl font-black text-foreground flex items-center gap-3">
                <div className="bg-primary/20 p-2 rounded-xl">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                Aktiv İmtahanlar
              </h2>
            </div>

            {isExamsLoading ? (
              <div className="h-64 flex items-center justify-center bg-card/40 backdrop-blur-2xl rounded-[3rem] border border-white/10 shadow-2xl">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : activeExams && activeExams.length > 0 ? (
              <Carousel className="w-full" opts={{ loop: true }}>
                <CarouselContent>
                  {activeExams.map((exam: any) => (
                    <CarouselItem key={exam.id}>
                      <Card className="border-none shadow-[0_32px_64px_-15px_rgba(0,0,0,0.3)] bg-card/40 backdrop-blur-2xl rounded-[3rem] overflow-hidden group hover:ring-4 ring-primary/20 transition-all duration-500">
                        <CardContent className="p-10 space-y-8">
                          <div className="space-y-3">
                            <h3 className="text-4xl font-black text-foreground group-hover:text-primary transition-colors leading-tight">{exam.name}</h3>
                            <p className="text-muted-foreground font-medium text-lg leading-relaxed">Bu imtahana qoşularaq biliyinizi ən müasir AI meyarları ilə yoxlayın.</p>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            <div className="bg-background/40 backdrop-blur-md p-6 rounded-3xl flex items-center gap-4 border border-white/5 shadow-inner">
                              <div className="bg-primary/10 p-3 rounded-2xl">
                                <Clock className="w-6 h-6 text-primary" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">Müddət</p>
                                <p className="text-lg font-bold">{exam.durationMinutes} dəq</p>
                              </div>
                            </div>
                            <div className="bg-primary/5 backdrop-blur-md p-6 rounded-3xl flex items-center gap-4 border border-primary/10 shadow-inner">
                              <div className="bg-primary/20 p-3 rounded-2xl">
                                <DollarSign className="w-6 h-6 text-primary" />
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase text-primary/60 tracking-widest">Qiymət</p>
                                <p className="text-lg font-bold text-primary">{exam.price} AZN</p>
                              </div>
                            </div>
                          </div>

                          <Button 
                            className="w-full h-16 rounded-[2rem] font-black text-xl bg-primary hover:bg-primary/90 shadow-2xl shadow-primary/30 gap-4 text-white hover:scale-[1.02] transition-transform"
                            onClick={() => handleBuyByTelegram(exam)}
                          >
                            <Send className="w-6 h-6" />
                            İndi Al (Telegram)
                          </Button>
                        </CardContent>
                      </Card>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <div className="hidden sm:block">
                  <CarouselPrevious className="-left-6 h-12 w-12 bg-card/60 backdrop-blur-xl border-white/10 hover:bg-primary hover:text-white" />
                  <CarouselNext className="-right-6 h-12 w-12 bg-card/60 backdrop-blur-xl border-white/10 hover:bg-primary hover:text-white" />
                </div>
              </Carousel>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center bg-card/40 backdrop-blur-2xl rounded-[3rem] border border-dashed border-white/10 text-muted-foreground shadow-2xl">
                <p className="font-bold text-xl">Hazırda aktiv imtahan yoxdur.</p>
              </div>
            )}
          </div>

          <div className="space-y-8">
            <h2 className="text-3xl font-black text-foreground px-2 flex items-center gap-3">
              <div className="bg-primary/20 p-2 rounded-xl">
                <Ticket className="w-6 h-6 text-primary" />
              </div>
              Sessiyaya Giriş
            </h2>
            <Card className="border border-white/10 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.3)] bg-card/40 backdrop-blur-3xl rounded-[3rem] overflow-hidden relative">
              <CardContent className="space-y-8 p-12">
                <div className="space-y-3">
                  <Label htmlFor="code" className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">İmtahan Giriş Kodu</Label>
                  <div className="relative group">
                    <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
                      <Ticket className="h-6 w-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
                    </div>
                    <Input 
                      id="code" 
                      placeholder="MƏS: A7B2C9" 
                      className="pl-14 uppercase font-mono tracking-[0.4em] text-2xl h-16 rounded-2xl border-none focus:ring-4 focus:ring-primary/20 transition-all bg-background/50 text-foreground shadow-inner"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                    />
                  </div>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label htmlFor="name" className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">Ad</Label>
                    <Input 
                      id="name" 
                      placeholder="Adınız" 
                      className="h-14 rounded-2xl border-none focus:ring-4 focus:ring-primary/20 bg-background/50 text-foreground font-bold shadow-inner"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label htmlFor="surname" className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">Soyad</Label>
                    <Input 
                      id="surname" 
                      placeholder="Soyadınız" 
                      className="h-14 rounded-2xl border-none focus:ring-4 focus:ring-primary/20 bg-background/50 text-foreground font-bold shadow-inner"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                    />
                  </div>
                </div>

                <Button 
                  className="w-full h-16 text-xl font-black rounded-[2rem] shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 transition-all duration-300 active:scale-[0.98] bg-primary text-white" 
                  onClick={handleEnter}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-3 h-7 w-7 animate-spin" />
                      Yoxlanılır...
                    </>
                  ) : 'İmtahana Başla'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      
      <footer className="w-full max-w-6xl py-12 flex flex-col md:flex-row justify-between items-center gap-6 z-10 border-t border-white/5 opacity-40 hover:opacity-100 transition-opacity">
        <p className="font-black text-sm tracking-widest uppercase">
          &copy; {new Date().getFullYear()} Sınaq Mərkəzi.
        </p>
        <div className="flex gap-8 font-black text-[10px] uppercase tracking-widest">
          <a href="#" className="hover:text-primary transition-colors">Şərtlər</a>
          <a href="#" className="hover:text-primary transition-colors">Məxfilik</a>
          <a href="#" className="hover:text-primary transition-colors">Əlaqə</a>
        </div>
      </footer>
    </div>
  );
}
