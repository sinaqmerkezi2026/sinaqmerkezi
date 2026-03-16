"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Plus, Calendar, Clock, DollarSign, Edit, LayoutDashboard, MessageSquare, Check, X, Info } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AdminDashboard() {
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  const examsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'exams'), orderBy('name'));
  }, [firestore]);

  const appealsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'appeals'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: exams, isLoading: isExamsLoading } = useCollection(examsQuery);
  const { data: appeals, isLoading: isAppealsLoading } = useCollection(appealsQuery);

  const [selectedAppeal, setSelectedAppeal] = useState<any>(null);
  const [adminComment, setAdminComment] = useState("");
  const [isProcessingAppeal, setIsProcessingAppeal] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') !== 'true') {
      router.push('/nicat/admin/login');
      return;
    }
  }, [router]);

  const createNewExam = () => {
    const id = Math.random().toString(36).substr(2, 9);
    router.push(`/nicat/admin/exam/${id}`);
  };

  const handleAppealDecision = async (status: 'approved' | 'rejected', awardedScore?: number) => {
    if (!selectedAppeal) return;
    setIsProcessingAppeal(true);

    try {
      const appealRef = doc(firestore, 'appeals', selectedAppeal.id);
      await updateDoc(appealRef, {
        status,
        adminComment,
        processedAt: Date.now(),
        awardedScore: awardedScore || 0
      });

      if (status === 'approved' && awardedScore !== undefined) {
        const attemptRef = doc(firestore, 'studentAttempts', selectedAppeal.attemptId);
        const attemptSnap = await getDoc(attemptRef);
        
        if (attemptSnap.exists()) {
          const attemptData = attemptSnap.data();
          const currentResults = attemptData.results || {};
          
          const updatedResults = {
            ...currentResults,
            [selectedAppeal.questionId]: {
              ...currentResults[selectedAppeal.questionId],
              score: awardedScore,
              feedback: `Apelyasiya təsdiqləndi: ${adminComment}`
            }
          };

          await updateDoc(attemptRef, { results: updatedResults });
        }
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

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card/80 backdrop-blur-md border-b sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-xl">
            <LayoutDashboard className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-xl font-black text-foreground">İdarəetmə Paneli</h1>
        </div>
        <div className="flex items-center gap-4">
          <ThemeToggle />
          <Button onClick={createNewExam} className="font-black rounded-xl shadow-lg transition-all text-white">
            <Plus className="w-4 h-4 mr-2" />
            Yeni İmtahan
          </Button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="exams" className="space-y-6">
          <TabsList className="bg-muted p-1 rounded-xl shadow-inner">
            <TabsTrigger value="exams" className="rounded-lg px-8 font-bold data-[state=active]:bg-background">İmtahanlar</TabsTrigger>
            <TabsTrigger value="appeals" className="rounded-lg px-8 font-bold data-[state=active]:bg-background gap-2">
              Apelyasiyalar
              {appeals?.filter(a => a.status === 'pending').length > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center p-0 text-[10px] rounded-full">
                  {appeals.filter(a => a.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exams">
            {isExamsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-3xl" />)}
              </div>
            ) : !exams || exams.length === 0 ? (
              <Card className="border-dashed border-4 py-24 flex flex-col items-center justify-center text-muted-foreground bg-transparent rounded-[2.5rem]">
                <Plus className="w-16 h-16 mb-4 opacity-10" />
                <p className="text-xl font-bold">Hələ heç bir imtahan yaradılmayıb</p>
                <Button variant="link" onClick={createNewExam} className="text-primary font-bold">İlk imtahanı yarat</Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams.map((exam: any) => (
                  <Card key={exam.id} className="group hover:shadow-2xl transition-all border-none bg-card/50 backdrop-blur-sm rounded-[2rem] overflow-hidden hover:ring-2 ring-primary/20">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-xl font-black group-hover:text-primary transition-colors">
                          {exam.name}
                        </CardTitle>
                        <Badge variant="outline" className="font-mono bg-primary/5 text-primary border-primary/20">
                          Aktiv
                        </Badge>
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
                      <Button 
                        variant="ghost" 
                        className="w-full font-black text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl"
                        onClick={() => router.push(`/nicat/admin/exam/${exam.id}`)}
                      >
                        <Edit className="w-4 h-4 mr-2" />
                        Düzəliş et
                      </Button>
                    </CardFooter>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="appeals">
            <Card className="border-none bg-card/50 backdrop-blur-sm shadow-xl rounded-[2.5rem] overflow-hidden">
              <ScrollArea className="h-[70vh]">
                <div className="p-8 space-y-4">
                  {!appeals || appeals.length === 0 ? (
                    <div className="text-center py-24 opacity-20 flex flex-col items-center gap-6">
                      <MessageSquare className="w-20 h-20" />
                      <p className="text-2xl font-black">Hələ heç bir apelyasiya müraciəti yoxdur.</p>
                    </div>
                  ) : (
                    appeals.map((appeal: any) => (
                      <div key={appeal.id} className="flex items-center justify-between p-6 bg-muted/20 border border-border/50 rounded-2xl hover:bg-muted/40 transition-all group">
                        <div className="space-y-2">
                          <div className="flex items-center gap-4">
                            <span className="font-black text-foreground text-lg">{appeal.studentName}</span>
                            <Badge variant={appeal.status === 'approved' ? 'default' : appeal.status === 'rejected' ? 'destructive' : 'secondary'} className="rounded-lg">
                              {appeal.status === 'pending' ? 'Gözləmədə' : appeal.status === 'approved' ? `Təsdiqləndi (+${appeal.awardedScore})` : 'Rədd edildi'}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground max-w-xl line-clamp-1 italic">"{appeal.studentReason}"</p>
                          <p className="text-[10px] text-muted-foreground/50 font-mono uppercase tracking-widest">ID: {appeal.id} • {new Date(appeal.createdAt).toLocaleString()}</p>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="rounded-xl font-bold bg-background shadow-sm" onClick={() => setSelectedAppeal(appeal)}>
                            <Info className="w-4 h-4 mr-2" />
                            Detallar
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!selectedAppeal} onOpenChange={(open) => !open && setSelectedAppeal(null)}>
        <DialogContent className="max-w-2xl rounded-[2rem] bg-card border-border/50 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Apelyasiya Detalları</DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground">
              Tələbənin müraciətini dəyərləndirin və müvafiq balı təyin edin.
            </DialogDescription>
          </DialogHeader>
          
          {selectedAppeal && (
            <div className="space-y-6 py-6">
              <div className="space-y-3">
                <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em]">Tələbənin Səbəbi:</h4>
                <div className="p-6 bg-muted/30 rounded-[1.5rem] font-bold text-foreground italic border border-border/50 leading-relaxed">
                  "{selectedAppeal.studentReason}"
                </div>
              </div>

              {selectedAppeal.status === 'pending' ? (
                <div className="space-y-4">
                  <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em]">Qərarınız və Rəyiniz:</h4>
                  <Textarea 
                    placeholder="Tələbəyə rəyinizi bura yazın..."
                    value={adminComment}
                    onChange={(e) => setAdminComment(e.target.value)}
                    className="min-h-[120px] rounded-2xl bg-muted/20 border-border/50 text-lg"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-4">
                    <Button 
                      className="bg-green-600 hover:bg-green-700 font-black h-14 rounded-2xl text-white shadow-lg" 
                      onClick={() => handleAppealDecision('approved', 1)}
                      disabled={isProcessingAppeal}
                    >
                      +1
                    </Button>
                    <Button 
                      className="bg-green-500 hover:bg-green-600 font-black h-14 rounded-2xl text-white shadow-lg" 
                      onClick={() => handleAppealDecision('approved', 2/3)}
                      disabled={isProcessingAppeal}
                    >
                      +2/3
                    </Button>
                    <Button 
                      className="bg-green-400 hover:bg-green-500 font-black h-14 rounded-2xl text-white shadow-lg" 
                      onClick={() => handleAppealDecision('approved', 1/2)}
                      disabled={isProcessingAppeal}
                    >
                      +1/2
                    </Button>
                    <Button 
                      className="bg-green-300 hover:bg-green-400 font-black h-14 rounded-2xl text-white shadow-lg" 
                      onClick={() => handleAppealDecision('approved', 1/3)}
                      disabled={isProcessingAppeal}
                    >
                      +1/3
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="font-black h-14 rounded-2xl shadow-lg" 
                      onClick={() => handleAppealDecision('rejected')}
                      disabled={isProcessingAppeal}
                    >
                      Rədd et
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 pt-6 border-t border-border/50">
                  <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em]">Sizin Rəyiniz:</h4>
                  <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl font-bold text-foreground">
                    {selectedAppeal.adminComment || "Rəy bildirilməyib."}
                  </div>
                  {selectedAppeal.status === 'approved' && (
                    <div className="inline-flex items-center gap-2 text-green-500 font-black bg-green-500/10 px-6 py-2 rounded-full mt-2">
                      <Check className="w-4 h-4" />
                      Verilən bal: +{selectedAppeal.awardedScore === 1 ? '1' : selectedAppeal.awardedScore.toFixed(2)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}