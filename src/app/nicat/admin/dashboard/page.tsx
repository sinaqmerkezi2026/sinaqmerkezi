"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Plus, Calendar, Clock, DollarSign, Edit, LayoutDashboard, MessageSquare, Check, X, Info, HelpCircle, User, FileText, Sparkles, AlertCircle, Ticket, Search, Power, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, getDoc, updateDoc, deleteDoc, where } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export default function AdminDashboard() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('admin_auth') !== 'true') {
      router.push('/nicat/admin/login');
    } else {
      setIsAuthenticated(true);
    }
  }, [router]);

  // Queries
  const examsQuery = useMemoFirebase(() => query(collection(firestore, 'exams'), orderBy('name')), [firestore]);
  const appealsQuery = useMemoFirebase(() => query(collection(firestore, 'appeals'), orderBy('createdAt', 'desc')), [firestore]);
  const promosQuery = useMemoFirebase(() => query(collection(firestore, 'promoCodes'), orderBy('createdAt', 'desc')), [firestore]);

  const { data: exams, isLoading: isExamsLoading } = useCollection(examsQuery);
  const { data: appeals, isLoading: isAppealsLoading } = useCollection(appealsQuery);
  const { data: promos, isLoading: isPromosLoading } = useCollection(promosQuery);

  // States
  const [selectedAppeal, setSelectedAppeal] = useState<any>(null);
  const [appealContext, setAppealContext] = useState<any>(null);
  const [adminComment, setAdminComment] = useState("");
  const [isProcessingAppeal, setIsProcessingAppeal] = useState(false);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [promoSearch, setPromoSearch] = useState("");

  // Filter promos
  const filteredPromos = useMemo(() => {
    if (!promos) return [];
    if (!promoSearch) return promos;
    return promos.filter(p => p.code.toLowerCase().includes(promoSearch.toLowerCase()) || p.studentName?.toLowerCase().includes(promoSearch.toLowerCase()));
  }, [promos, promoSearch]);

  // Context fetching for appeal details
  useEffect(() => {
    async function fetchAppealContext() {
      if (!selectedAppeal) {
        setAppealContext(null);
        return;
      }
      setIsContextLoading(true);
      try {
        const attemptRef = doc(firestore, 'studentAttempts', selectedAppeal.attemptId);
        const attemptSnap = await getDoc(attemptRef);
        if (attemptSnap.exists()) {
          const attemptData = attemptSnap.data();
          const examRef = doc(firestore, 'exams', attemptData.examId);
          const examSnap = await getDoc(examRef);
          if (examSnap.exists()) {
            const examData = examSnap.data();
            const question = examData.questions?.find((q: any) => q.id === selectedAppeal.questionId);
            const studentAnswer = attemptData.answers?.[selectedAppeal.questionId];
            setAppealContext({ question, studentAnswer, examName: examData.name });
          } else {
            setAppealContext({ error: "İmtahan tapılmadı." });
          }
        } else {
          setAppealContext({ error: "Sessiya tapılmadı." });
        }
      } catch (e) {
        setAppealContext({ error: "Məlumat yüklənərkən xəta baş verdi." });
      } finally {
        setIsContextLoading(false);
      }
    }
    fetchAppealContext();
  }, [selectedAppeal, firestore]);

  const handleAppealDecision = async (status: 'approved' | 'rejected', awardedScore: number = 0) => {
    if (!selectedAppeal) return;
    setIsProcessingAppeal(true);
    try {
      const appealRef = doc(firestore, 'appeals', selectedAppeal.id);
      await updateDoc(appealRef, { status, adminComment, processedAt: Date.now(), awardedScore });
      const attemptRef = doc(firestore, 'studentAttempts', selectedAppeal.attemptId);
      const attemptSnap = await getDoc(attemptRef);
      if (attemptSnap.exists()) {
        const attemptData = attemptSnap.data();
        const updatedResults = {
          ...(attemptData.results || {}),
          [selectedAppeal.questionId]: {
            ...(attemptData.results?.[selectedAppeal.questionId] || {}),
            score: status === 'approved' ? awardedScore : (attemptData.results?.[selectedAppeal.questionId]?.score || 0),
            feedback: status === 'approved' ? `Apelyasiya təsdiqləndi: ${adminComment}` : `Apelyasiya rədd edildi: ${adminComment}`,
            isAppealed: true,
            appealStatus: status
          }
        };
        const examRef = doc(firestore, 'exams', attemptData.examId);
        const examSnap = await getDoc(examRef);
        let earnedPoints = 0;
        let maxPoints = 0;
        if (examSnap.exists()) {
          const examData = examSnap.data();
          const questions = examData.questions || [];
          maxPoints = questions.length;
          questions.forEach((q: any) => {
            const res = updatedResults[q.id];
            if (res) earnedPoints += res.score || 0;
            else if (q.type === 'mcq' || q.type === 'open') {
              const ans = attemptData.answers?.[q.id];
              if (ans?.finalAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase()) earnedPoints += 1;
            }
          });
        }
        await updateDoc(attemptRef, { 
          results: updatedResults, 
          earnedPoints, 
          maxPoints, 
          totalScore: maxPoints > 0 ? (earnedPoints / maxPoints) * 100 : 0 
        });
      }
      toast({ title: 'Uğurlu', description: `Apelyasiya ${status === 'approved' ? 'təsdiqləndi' : 'rədd edildi'}.` });
      setSelectedAppeal(null);
      setAdminComment("");
    } catch (e) {
      toast({ title: 'Xəta', description: 'Əməliyyat uğursuz oldu.', variant: 'destructive' });
    } finally {
      setIsProcessingAppeal(false);
    }
  };

  const togglePromoStatus = async (promoId: string, field: 'isActive' | 'isUsed', currentVal: boolean) => {
    try {
      await updateDoc(doc(firestore, 'promoCodes', promoId), { [field]: !currentVal });
      toast({ title: 'Yeniləndi', description: `Promo kod statusu dəyişdirildi.` });
    } catch (e) {
      toast({ title: 'Xəta', description: 'Yeniləmə mümkün olmadı.', variant: 'destructive' });
    }
  };

  const deletePromo = async (promoId: string) => {
    if (!confirm("Bu promo kodu silmək istədiyinizə əminsiniz?")) return;
    try {
      await deleteDoc(doc(firestore, 'promoCodes', promoId));
      toast({ title: 'Silindi', description: 'Promo kod bazadan təmizləndi.' });
    } catch (e) {
      toast({ title: 'Xəta', description: 'Silmək mümkün olmadı.', variant: 'destructive' });
    }
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card/80 backdrop-blur-md border-b sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-xl">
            <LayoutDashboard className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-black text-foreground">İdarəetmə Paneli</h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button onClick={() => router.push(`/nicat/admin/exam/${Math.random().toString(36).substr(2, 9)}`)} className="font-black rounded-xl shadow-lg transition-all text-white">
            <Plus className="w-4 h-4 mr-2" />
            Yeni İmtahan
          </Button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="exams" className="space-y-6">
          <TabsList className="bg-muted p-1 rounded-xl shadow-inner flex flex-wrap h-auto">
            <TabsTrigger value="exams" className="rounded-lg px-8 font-bold data-[state=active]:bg-background">İmtahanlar</TabsTrigger>
            <TabsTrigger value="appeals" className="rounded-lg px-8 font-bold data-[state=active]:bg-background gap-2">
              Apelyasiyalar
              {appeals?.filter(a => a.status === 'pending').length > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center p-0 text-[10px] rounded-full animate-pulse">
                  {appeals.filter(a => a.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="promos" className="rounded-lg px-8 font-bold data-[state=active]:bg-background gap-2">
              Promo Kodlar
              <Badge variant="secondary" className="h-5 min-w-5 flex items-center justify-center p-0 text-[10px] rounded-full">
                {promos?.length || 0}
              </Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exams">
            {isExamsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-[2.5rem]" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams?.map((exam: any) => (
                  <Card key={exam.id} className="group hover:shadow-2xl transition-all border-none bg-card/50 backdrop-blur-sm rounded-[2.5rem] overflow-hidden hover:ring-2 ring-primary/20">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-xl font-black group-hover:text-primary transition-colors">{exam.name}</CardTitle>
                        <Badge variant="outline" className="font-mono bg-primary/5 text-primary border-primary/20">AKTİV</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4 pt-4">
                      <div className="flex items-center text-sm text-muted-foreground gap-3 font-medium">
                        <Calendar className="w-4 h-4 text-primary/60" />
                        <span>{exam.activeStartDate} - {exam.activeEndDate}</span>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground gap-3 font-medium">
                        <Clock className="w-4 h-4 text-primary/60" />
                        <span>{exam.durationMinutes} dəqiqə</span>
                      </div>
                      <div className="flex items-center text-sm font-black text-primary gap-3">
                        <DollarSign className="w-4 h-4" />
                        <span>{exam.price?.toFixed(2)} AZN</span>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-4 border-t border-border/50">
                      <Button variant="ghost" className="w-full font-black text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl" onClick={() => router.push(`/nicat/admin/exam/${exam.id}`)}>
                        <Edit className="w-4 h-4 mr-2" /> Redaktə
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="appeals">
            <Card className="border-none bg-card/50 backdrop-blur-sm shadow-xl rounded-[2.5rem] overflow-hidden">
              <ScrollArea className="h-[75vh]">
                <div className="p-8 space-y-4">
                  {!appeals || appeals.length === 0 ? (
                    <div className="text-center py-24 opacity-20 flex flex-col items-center gap-6">
                      <MessageSquare className="w-20 h-20" />
                      <p className="text-2xl font-black">Müraciət yoxdur.</p>
                    </div>
                  ) : (
                    appeals.map((appeal: any) => (
                      <div key={appeal.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/40 transition-all gap-4">
                        <div className="space-y-2">
                          <div className="flex items-center gap-4">
                            <span className="font-black text-foreground text-lg">{appeal.studentName}</span>
                            <Badge variant={appeal.status === 'approved' ? 'default' : appeal.status === 'rejected' ? 'destructive' : 'secondary'}>
                              {appeal.status === 'pending' ? 'Gözləmədə' : appeal.status === 'approved' ? `Təsdiqləndi (+${(appeal.awardedScore || 0).toFixed(2)})` : 'Rədd edildi'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground italic">"{appeal.studentReason}"</p>
                          <p className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-widest">{new Date(appeal.createdAt).toLocaleString()}</p>
                        </div>
                        <Button variant="outline" size="sm" className="rounded-xl font-bold bg-background shadow-sm w-full sm:w-auto" onClick={() => setSelectedAppeal(appeal)}>
                          <Info className="w-4 h-4 mr-2" /> Detallar
                        </Button>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>

          <TabsContent value="promos">
            <Card className="border-none bg-card/50 backdrop-blur-sm shadow-xl rounded-[2.5rem] overflow-hidden">
              <div className="p-8 border-b border-border/50 space-y-4">
                <div className="relative group max-w-md">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <Input 
                    placeholder="Kod və ya şagird adı ilə axtar..." 
                    value={promoSearch} 
                    onChange={e => setPromoSearch(e.target.value)}
                    className="pl-12 h-12 rounded-2xl bg-muted/20 border-border/50 font-bold"
                  />
                </div>
              </div>
              <ScrollArea className="h-[65vh]">
                <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  {filteredPromos.length === 0 ? (
                    <div className="col-span-full text-center py-24 opacity-20 flex flex-col items-center gap-6">
                      <Ticket className="w-20 h-20" />
                      <p className="text-2xl font-black">Promo kod tapılmadı.</p>
                    </div>
                  ) : (
                    filteredPromos.map((promo: any) => (
                      <Card key={promo.id} className="rounded-3xl border-none bg-muted/20 hover:bg-muted/30 transition-all p-6 space-y-6">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">KOD:</span>
                            <div className="text-2xl font-black text-primary font-mono">{promo.code}</div>
                          </div>
                          <Badge className="bg-primary text-white text-xl px-4 py-2 rounded-xl">
                            {promo.discountPercent}%
                          </Badge>
                        </div>

                        <div className="space-y-3">
                          <div className="flex items-center gap-3">
                            <User className="w-4 h-4 text-primary" />
                            <span className="font-bold text-foreground">{promo.studentName}</span>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] font-black text-muted-foreground uppercase">
                            <Clock className="w-4 h-4" />
                            {new Date(promo.createdAt).toLocaleString()}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/30">
                          <div className="flex flex-col gap-2">
                            <Label className="text-[9px] font-black text-muted-foreground uppercase">İstifadə Statusu</Label>
                            <div className="flex items-center gap-2">
                              <Switch 
                                checked={promo.isUsed} 
                                onCheckedChange={() => togglePromoStatus(promo.id, 'isUsed', promo.isUsed)}
                              />
                              <span className={cn("text-xs font-black", promo.isUsed ? "text-red-500" : "text-green-500")}>
                                {promo.isUsed ? "İŞLƏNİB" : "MÖVCUD"}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label className="text-[9px] font-black text-muted-foreground uppercase">Aktivlik</Label>
                            <div className="flex items-center gap-2">
                              <Switch 
                                checked={promo.isActive} 
                                onCheckedChange={() => togglePromoStatus(promo.id, 'isActive', promo.isActive)}
                              />
                              <span className={cn("text-xs font-black", promo.isActive ? "text-primary" : "text-muted-foreground")}>
                                {promo.isActive ? "AKTİV" : "DEAKTİV"}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="w-full mt-2 text-destructive hover:bg-destructive/10 rounded-xl"
                          onClick={() => deletePromo(promo.id)}
                        >
                          <Trash2 className="w-4 h-4 mr-2" /> Sil
                        </Button>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedAppeal} onOpenChange={(open) => !open && setSelectedAppeal(null)}>
        <DialogContent className="max-w-4xl rounded-[2.5rem] bg-card border-border/50 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-8 border-b bg-muted/20">
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-primary" /> Apelyasiya Detalları
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-8 space-y-10 pb-20">
              {isContextLoading ? <Skeleton className="h-64 w-full rounded-3xl" /> : appealContext?.error ? <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertTitle>Xəta</AlertTitle><AlertDescription>{appealContext.error}</AlertDescription></Alert> : appealContext && (
                <>
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase text-primary">Sual:</h4>
                    <Card className="rounded-2xl bg-muted/30 p-6 space-y-4 shadow-inner">
                      <p className="text-lg font-bold">{appealContext.question?.text}</p>
                      {appealContext.question?.image && <img src={appealContext.question.image} className="rounded-xl max-w-md border-2" />}
                    </Card>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase text-primary">Tələbənin Cavabı:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="p-6 bg-primary/5 rounded-2xl"><span className="text-[10px] uppercase font-black">Yekun:</span><p className="text-xl font-black">{appealContext.studentAnswer?.finalAnswer || "Cavab yoxdur"}</p></Card>
                      <Card className="p-6 bg-muted/50 rounded-2xl"><span className="text-[10px] uppercase font-black">İzah:</span><p className="text-sm font-medium italic">"{appealContext.studentAnswer?.explanation || "İzah yoxdur"}"</p></Card>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-xs font-black uppercase text-destructive">Tələbənin Səbəbi:</h4>
                    <div className="p-6 bg-destructive/5 border-2 border-dashed border-destructive/20 rounded-2xl font-bold italic">"{selectedAppeal.studentReason}"</div>
                  </div>
                  <div className="space-y-6 pt-6 border-t border-border/50">
                    {selectedAppeal.status === 'pending' ? (
                      <div className="space-y-4">
                        <Textarea placeholder="Rəyiniz..." value={adminComment} onChange={e => setAdminComment(e.target.value)} className="rounded-2xl" />
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <Button className="bg-green-600 font-black rounded-xl" onClick={() => handleAppealDecision('approved', 1)}>+1.00</Button>
                          <Button className="bg-lime-500 font-black rounded-xl" onClick={() => handleAppealDecision('approved', 0.67)}>+0.67</Button>
                          <Button className="bg-lime-400 font-black rounded-xl" onClick={() => handleAppealDecision('approved', 0.5)}>+0.50</Button>
                          <Button className="bg-lime-300 font-black rounded-xl" onClick={() => handleAppealDecision('approved', 0.33)}>+0.33</Button>
                          <Button variant="destructive" className="font-black rounded-xl" onClick={() => handleAppealDecision('rejected')}>Rədd et</Button>
                        </div>
                      </div>
                    ) : (
                      <div className="p-6 bg-primary/5 rounded-2xl font-bold">Rəy: {selectedAppeal.adminComment || "Yoxdur"}</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
