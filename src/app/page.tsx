"use client";

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { LogIn, GraduationCap, Ticket, Loader2, Sparkles, Clock, DollarSign, Send, Trophy, Heart, Info, Search, LayoutGrid, Target, MessageCircle } from 'lucide-react';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, orderBy } from 'firebase/firestore';
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
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

export default function StudentEntry() {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [surname, setSurname] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();

  const examsQuery = useMemoFirebase(() => query(collection(firestore, 'exams')), [firestore]);
  const categoriesQuery = useMemoFirebase(() => query(collection(firestore, 'categories'), orderBy('name')), [firestore]);

  const { data: allExams, isLoading: isExamsLoading } = useCollection(examsQuery);
  const { data: categories, isLoading: isCategoriesLoading } = useCollection(categoriesQuery);

  const filteredExams = useMemo(() => {
    if (!allExams) return [];
    return allExams.filter(exam => {
      const matchesSearch = exam.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategoryId === "all" || exam.categoryId === selectedCategoryId;
      return matchesSearch && matchesCategory;
    });
  }, [allExams, searchQuery, selectedCategoryId]);

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
    const telegramUsername = "sinaqmerkezi"; 
    const message = encodeURIComponent(`Salam, mən "${exam.name}" imtahanı üçün giriş kodu almaq istəyirəm. Qiymət: ${exam.price} AZN.`);
    const url = `https://t.me/${telegramUsername}?text=${message}`;
    window.open(url, '_blank');
  };

  const handleSupport = () => {
    const telegramUsername = "sinaqmerkezi";
    const url = `https://t.me/${telegramUsername}`;
    window.open(url, '_blank');
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center p-6 relative overflow-hidden">
      {/* Background Decorations */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-primary/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-500/5 rounded-full blur-[120px] pointer-events-none" />

      <header className="w-full max-w-6xl flex justify-between items-center z-50 py-4 px-6 bg-card/40 backdrop-blur-xl rounded-3xl border border-white/10 mt-2 shadow-2xl">
        <div className="flex items-center gap-3">
          <div className="bg-primary p-2 rounded-2xl">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="font-black text-2xl tracking-tight text-foreground">Sınaq<span className="text-primary">Mərkəzi</span></span>
        </div>
        <div className="flex items-center gap-2 md:gap-4">
          <div className="hidden md:flex items-center gap-2">
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="ghost" className="font-bold gap-2 hover:bg-primary/10 rounded-xl">
                  <Info className="w-5 h-5" />
                  Haqqımızda
                </Button>
              </DialogTrigger>
              <DialogContent className="rounded-3xl">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-black">Sınaq Mərkəzi Nədir?</DialogTitle>
                  <DialogDescription className="text-lg font-medium pt-4 space-y-4 text-foreground/80">
                    <p>Sınaq Mərkəzi şagirdlərin imtahanlara daha peşəkar və süni intellekt dəstəyi ilə hazırlaşması üçün yaradılmış platformadır.</p>
                    <ul className="list-disc pl-5 space-y-2">
                      <li>İzahlı suallarda AI (Süni İntellekt) qiymətləndirməsi</li>
                      <li>Kateqoriya üzrə ixtisaslaşmış imtahanlar</li>
                      <li>Liderlər lövhəsi ilə rəqabət mühiti</li>
                      <li>Şəffaf və ədalətli apelyasiya sistemi</li>
                    </ul>
                  </DialogDescription>
                </DialogHeader>
              </DialogContent>
            </Dialog>

            <Button variant="ghost" onClick={handleSupport} className="font-bold gap-2 hover:bg-primary/10 rounded-xl">
              <MessageCircle className="w-5 h-5" />
              Dəstək
            </Button>
          </div>

          <Button variant="ghost" onClick={() => router.push('/ranking')} className="font-bold gap-2 text-primary hover:bg-primary/10 rounded-xl">
            <Trophy className="w-5 h-5" />
            Liderlər
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <div className="w-full max-w-6xl mt-12 space-y-16 relative z-10 flex-1">
        <div className="text-center space-y-8">
          <h1 className="text-6xl md:text-7xl font-black tracking-tight text-foreground leading-none">
            Gələcəyini <span className="text-primary">İndi Qur</span>
          </h1>
          
          <div className="max-w-4xl mx-auto space-y-6">
            <div className="relative group">
              <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-6 h-6 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <Input 
                placeholder="İmtahan axtar..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="h-16 pl-14 pr-6 rounded-3xl border-none bg-card/60 backdrop-blur-xl text-xl font-bold shadow-2xl focus:ring-4 focus:ring-primary/20 transition-all"
              />
            </div>

            <ScrollArea className="w-full whitespace-nowrap pb-4">
              <div className="flex w-max space-x-3 px-1">
                <Button 
                  onClick={() => setSelectedCategoryId("all")}
                  variant={selectedCategoryId === "all" ? "default" : "secondary"}
                  className={cn(
                    "rounded-full h-12 px-8 font-black text-sm transition-all shadow-md",
                    selectedCategoryId === "all" ? "shadow-primary/30" : "bg-card/40 backdrop-blur-md"
                  )}
                >
                  <LayoutGrid className="w-4 h-4 mr-2" />
                  Hamısı
                </Button>
                {categories?.map((cat) => (
                  <Button 
                    key={cat.id}
                    onClick={() => setSelectedCategoryId(cat.id)}
                    variant={selectedCategoryId === cat.id ? "default" : "secondary"}
                    className={cn(
                      "rounded-full h-12 px-8 font-black text-sm transition-all shadow-md",
                      selectedCategoryId === cat.id ? "shadow-primary/30" : "bg-card/40 backdrop-blur-md"
                    )}
                  >
                    <Target className="w-4 h-4 mr-2" />
                    {cat.name}
                  </Button>
                ))}
              </div>
              <ScrollBar orientation="horizontal" className="hidden" />
            </ScrollArea>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start pb-20">
          <div className="space-y-8">
            <div className="flex items-center justify-between px-4">
              <h2 className="text-3xl font-black text-foreground">Aktiv İmtahanlar</h2>
              <Badge variant="outline" className="rounded-full font-black text-primary border-primary/20">{filteredExams.length} İmtahan</Badge>
            </div>

            {isExamsLoading ? (
              <div className="h-64 flex items-center justify-center bg-card/40 backdrop-blur-2xl rounded-[3rem] border border-white/10">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
              </div>
            ) : filteredExams.length > 0 ? (
              <div className="grid grid-cols-1 gap-6">
                {filteredExams.map((exam: any) => (
                  <Card key={exam.id} className="border-none shadow-xl bg-card/40 backdrop-blur-2xl rounded-[2.5rem] overflow-hidden group hover:ring-4 ring-primary/20 transition-all duration-500">
                    <CardContent className="p-8 space-y-6">
                      <div className="flex justify-between items-start">
                        <h3 className="text-3xl font-black text-foreground group-hover:text-primary transition-colors leading-tight">{exam.name}</h3>
                        <div className="bg-primary/10 px-4 py-2 rounded-2xl text-primary font-black text-xl">
                          {exam.price.toFixed(2)} AZN
                        </div>
                      </div>

                      <div className="flex items-center gap-6">
                        <div className="flex items-center gap-2 text-muted-foreground font-black text-sm">
                          <Clock className="w-5 h-5 text-primary/60" />
                          {exam.durationMinutes} dəq
                        </div>
                        <Badge variant="secondary" className="bg-muted/50 text-muted-foreground font-black border-none uppercase tracking-widest text-[10px]">
                          {categories?.find(c => c.id === exam.categoryId)?.name || "Ümumi"}
                        </Badge>
                      </div>

                      <Button 
                        className="w-full h-14 rounded-2xl font-black text-lg bg-primary hover:bg-primary/90 shadow-lg gap-3 text-white transition-all hover:scale-[1.02]"
                        onClick={() => handleBuyByTelegram(exam)}
                      >
                        <Send className="w-5 h-5" />
                        Giriş Kodu Al (Telegram)
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center bg-card/40 backdrop-blur-2xl rounded-[3rem] border border-dashed border-white/10 text-muted-foreground">
                <p className="font-bold text-xl">Nəticə tapılmadı.</p>
              </div>
            )}
          </div>

          <div className="space-y-8 lg:sticky lg:top-24">
            <h2 className="text-3xl font-black text-foreground px-4">Sessiyaya Giriş</h2>
            <Card className="border border-white/10 shadow-2xl bg-card/40 backdrop-blur-3xl rounded-[3rem] overflow-hidden">
              <CardContent className="space-y-8 p-10">
                <div className="space-y-3">
                  <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">Giriş Kodu</Label>
                  <Input 
                    placeholder="MƏS: A7B2C9" 
                    className="uppercase font-mono tracking-[0.4em] text-2xl h-16 rounded-2xl border-none bg-background/50 text-foreground shadow-inner focus:ring-4 focus:ring-primary/20 transition-all"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                  />
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">Ad</Label>
                    <Input 
                      placeholder="Adınız" 
                      className="h-14 rounded-2xl border-none bg-background/50 text-foreground font-bold shadow-inner focus:ring-4 focus:ring-primary/20 transition-all"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-3">
                    <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">Soyad</Label>
                    <Input 
                      placeholder="Soyadınız" 
                      className="h-14 rounded-2xl border-none bg-background/50 text-foreground font-bold shadow-inner focus:ring-4 focus:ring-primary/20 transition-all"
                      value={surname}
                      onChange={(e) => setSurname(e.target.value)}
                    />
                  </div>
                </div>

                <Button 
                  className="w-full h-16 text-xl font-black rounded-[2rem] shadow-2xl shadow-primary/30 hover:shadow-primary/50 hover:-translate-y-1 transition-all duration-300 bg-primary text-white" 
                  onClick={handleEnter}
                  disabled={isLoading}
                >
                  {isLoading ? <Loader2 className="h-7 w-7 animate-spin" /> : 'İmtahana Başla'}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
