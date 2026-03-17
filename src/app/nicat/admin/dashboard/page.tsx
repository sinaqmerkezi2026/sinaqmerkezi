
"use client";

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Plus, Calendar, Clock, DollarSign, Edit, LayoutDashboard, MessageSquare, Check, X, Info, HelpCircle, User, FileText, Sparkles, AlertCircle, Ticket, Search, Power, Trash2, Tag, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, getDoc, updateDoc, deleteDoc, setDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
  const categoriesQuery = useMemoFirebase(() => query(collection(firestore, 'categories'), orderBy('name')), [firestore]);

  const { data: exams, isLoading: isExamsLoading } = useCollection(examsQuery);
  const { data: appeals, isLoading: isAppealsLoading } = useCollection(appealsQuery);
  const { data: promos, isLoading: isPromosLoading } = useCollection(promosQuery);
  const { data: categories, isLoading: isCategoriesLoading } = useCollection(categoriesQuery);

  // States
  const [selectedAppeal, setSelectedAppeal] = useState<any>(null);
  const [appealContext, setAppealContext] = useState<any>(null);
  const [adminComment, setAdminComment] = useState("");
  const [isProcessingAppeal, setIsProcessingAppeal] = useState(false);
  const [isContextLoading, setIsContextLoading] = useState(false);
  const [promoSearch, setPromoSearch] = useState("");
  
  // Category states
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");

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

  const handleDeleteExam = async (examId: string) => {
    if (!confirm("Bu imtahanı silmək istədiyinizə əminsiniz? Bu əməliyyat geri qaytarıla bilməz.")) return;
    try {
      await deleteDoc(doc(firestore, 'exams', examId));
      toast({ title: 'Uğurlu', description: 'İmtahan uğurla silindi.' });
    } catch (e) {
      toast({ title: 'Xəta', description: 'İmtahanı silmək mümkün olmadı.', variant: 'destructive' });
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;
    const catId = Math.random().toString(36).substr(2, 9);
    try {
      await setDoc(doc(firestore, 'categories', catId), {
        id: catId,
        name: newCategoryName.trim()
      });
      setNewCategoryName("");
      setIsCategoryDialogOpen(false);
      toast({ title: 'Uğurlu', description: 'Kateqoriya əlavə edildi.' });
    } catch (e) {
      toast({ title: 'Xəta', description: 'Əlavə etmək mümkün olmadı.', variant: 'destructive' });
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("Bu kateqoriyanı silmək istədiyinizə əminsiniz?")) return;
    try {
      await deleteDoc(doc(firestore, 'categories', id));
      toast({ title: 'Silindi', description: 'Kateqoriya silindi.' });
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
            <TabsTrigger value="categories" className="rounded-lg px-8 font-bold data-[state=active]:bg-background">Kateqoriyalar</TabsTrigger>
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
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exams">
            {isExamsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-[2.5rem]" />)}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams?.map((exam: any) => {
                  const category = categories?.find(c => c.id === exam.categoryId);
                  return (
                    <Card key={exam.id} className="group hover:shadow-2xl transition-all border-none bg-card/50 backdrop-blur-sm rounded-[2.5rem] overflow-hidden hover:ring-2 ring-primary/20">
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            <CardTitle className="text-xl font-black group-hover:text-primary transition-colors">{exam.name}</CardTitle>
                            {category && <Badge variant="secondary" className="bg-primary/10 text-primary border-none">{category.name}</Badge>}
                          </div>
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
                      <CardFooter className="pt-4 border-t border-border/50 gap-2">
                        <Button 
                          variant="ghost" 
                          className="flex-1 font-black text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl" 
                          onClick={() => router.push(`/nicat/admin/exam/${exam.id}`)}
                        >
                          <Edit className="w-4 h-4 mr-2" /> Redaktə
                        </Button>
                        <Button 
                          variant="ghost" 
                          className="px-3 font-black text-destructive hover:bg-destructive/10 rounded-xl" 
                          onClick={() => handleDeleteExam(exam.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categories">
            <Card className="border-none bg-card/50 backdrop-blur-sm shadow-xl rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 flex flex-row items-center justify-between border-b border-border/50">
                <CardTitle className="text-2xl font-black flex items-center gap-3">
                  <Layers className="w-6 h-6 text-primary" /> Kateqoriyalar
                </CardTitle>
                <Button onClick={() => setIsCategoryDialogOpen(true)} className="rounded-xl font-black shadow-md">
                  <Plus className="w-4 h-4 mr-2" /> Yeni Kateqoriya
                </Button>
              </CardHeader>
              <CardContent className="p-8">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {categories?.map((cat: any) => (
                    <Card key={cat.id} className="p-6 bg-muted/20 border-border/50 rounded-2xl flex items-center justify-between group hover:bg-muted/40 transition-all">
                      <span className="font-black text-lg text-foreground">{cat.name}</span>
                      <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => handleDeleteCategory(cat.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </Card>
                  ))}
                  {(!categories || categories.length === 0) && !isCategoriesLoading && (
                    <div className="col-span-full py-20 text-center opacity-20 flex flex-col items-center gap-4">
                      <Layers className="w-16 h-16" />
                      <p className="text-xl font-black">Kateqoriya tapılmadı.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
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
                        </div>
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <Button variant="outline" size="sm" className="flex-1 sm:flex-initial rounded-xl font-bold bg-background shadow-sm" onClick={() => setSelectedAppeal(appeal)}>
                            Detallar
                          </Button>
                          <Button variant="ghost" size="sm" className="px-3 rounded-xl text-destructive hover:bg-destructive/10" onClick={() => {
                            if(confirm("Silmək istəyirsiniz?")) deleteDoc(doc(firestore, 'appeals', appeal.id));
                          }}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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
                  {filteredPromos.map((promo: any) => (
                    <Card key={promo.id} className="rounded-3xl border-none bg-muted/20 p-6 space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="text-2xl font-black text-primary font-mono">{promo.code}</div>
                        <Badge className="bg-primary text-white text-xl px-4 py-2 rounded-xl">{promo.discountPercent}%</Badge>
                      </div>
                      <div className="font-bold text-foreground">{promo.studentName}</div>
                      <div className="flex items-center justify-between pt-4 border-t border-border/30">
                        <Badge variant={promo.isUsed ? 'destructive' : 'default'}>{promo.isUsed ? "İŞLƏNİB" : "MÖVCUD"}</Badge>
                        <Button variant="ghost" size="sm" className="text-destructive hover:bg-destructive/10" onClick={() => deleteDoc(doc(firestore, 'promoCodes', promo.id))}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-black">Yeni Kateqoriya</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <Label className="font-black text-sm uppercase tracking-widest opacity-60">Adı</Label>
            <Input value={newCategoryName} onChange={e => setNewCategoryName(e.target.value)} className="rounded-xl h-12 font-bold" placeholder="Məs: Blok İmtahanları" />
          </div>
          <DialogFooter>
            <Button onClick={handleAddCategory} className="w-full rounded-xl h-12 font-black shadow-lg">Əlavə et</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedAppeal} onOpenChange={(open) => !open && setSelectedAppeal(null)}>
        <DialogContent className="max-w-4xl rounded-[2.5rem] bg-card border-border/50 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-8 border-b bg-muted/20">
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-primary" /> Apelyasiya Detalları
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1">
            <div className="p-8 space-y-10 pb-20">
              {isContextLoading ? <Skeleton className="h-64 w-full rounded-3xl" /> : appealContext && (
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
