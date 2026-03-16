"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Plus, Calendar, Clock, DollarSign, Edit, LayoutDashboard, MessageSquare, Check, X, Info, HelpCircle, User, FileText, Sparkles, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, doc, getDoc, updateDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

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

  const examsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'exams'), orderBy('name'));
  }, [firestore]);

  const appealsQuery = useMemoFirebase(() => {
    return query(collection(firestore, 'appeals'), orderBy('createdAt', 'desc'));
  }, [firestore]);

  const { data: exams, isLoading: isExamsLoading } = useCollection(examsQuery);
  const { data: appeals, isLoading: isAppealsLoading } = useCollection(appealsQuery);

  const [selectedAppeal, setSelectedAppeal] = useState<any>(null);
  const [appealContext, setAppealContext] = useState<any>(null);
  const [adminComment, setAdminComment] = useState("");
  const [isProcessingAppeal, setIsProcessingAppeal] = useState(false);
  const [isContextLoading, setIsContextLoading] = useState(false);

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

            setAppealContext({
              question,
              studentAnswer,
              examName: examData.name
            });
          } else {
            setAppealContext({ error: "İmtahan tapılmadı." });
          }
        } else {
          setAppealContext({ error: "Sessiya tapılmadı." });
        }
      } catch (e) {
        console.error("Context fetch error:", e);
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
      await updateDoc(appealRef, {
        status,
        adminComment,
        processedAt: Date.now(),
        awardedScore: awardedScore
      });

      const attemptRef = doc(firestore, 'studentAttempts', selectedAppeal.attemptId);
      const attemptSnap = await getDoc(attemptRef);
      
      if (attemptSnap.exists()) {
        const attemptData = attemptSnap.data();
        const currentResults = attemptData.results || {};
        
        const updatedResults = {
          ...currentResults,
          [selectedAppeal.questionId]: {
            ...currentResults[selectedAppeal.questionId],
            score: status === 'approved' ? awardedScore : (currentResults[selectedAppeal.questionId]?.score || 0),
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
             const ans = attemptData.answers?.[q.id];
             if (!ans) return;
             
             const questionResult = updatedResults[q.id];
             if (questionResult && typeof questionResult.score === 'number') {
               earnedPoints += questionResult.score;
             } else if (q.type === 'mcq' || q.type === 'open') {
               if (ans.finalAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase()) {
                 earnedPoints += 1;
               }
             }
           });
        }

        const totalScore = maxPoints > 0 ? (earnedPoints / maxPoints) * 100 : 0;

        await updateDoc(attemptRef, { 
          results: updatedResults,
          earnedPoints: earnedPoints,
          totalScore: totalScore,
          maxPoints: maxPoints
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

  if (!isAuthenticated) return null;

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
          <Button onClick={() => router.push(`/nicat/admin/exam/${Math.random().toString(36).substr(2, 9)}`)} className="font-black rounded-xl shadow-lg transition-all text-white">
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
                <Button variant="link" onClick={() => router.push(`/nicat/admin/exam/${Math.random().toString(36).substr(2, 9)}`)} className="text-primary font-bold">İlk imtahanı yarat</Button>
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
              <ScrollArea className="h-[75vh]">
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
                              {appeal.status === 'pending' ? 'Gözləmədə' : appeal.status === 'approved' ? `Təsdiqləndi (+${(appeal.awardedScore || 0).toFixed(2)})` : 'Rədd edildi'}
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
        <DialogContent className="max-w-4xl rounded-[2rem] bg-card border-border/50 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col p-0">
          <DialogHeader className="p-8 border-b bg-muted/20">
            <DialogTitle className="text-2xl font-black flex items-center gap-3">
              <MessageSquare className="w-6 h-6 text-primary" />
              Apelyasiya Detalları
            </DialogTitle>
            <DialogDescription className="font-medium text-muted-foreground">
              {selectedAppeal?.studentName} tərəfindən göndərilən müraciət.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1">
            <div className="p-8 space-y-10 pb-20">
              {isContextLoading && (
                <div className="space-y-6">
                  <Skeleton className="h-32 w-full rounded-2xl" />
                  <Skeleton className="h-24 w-full rounded-2xl" />
                </div>
              )}

              {!isContextLoading && appealContext?.error && (
                <Alert variant="destructive" className="rounded-2xl">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Xəta</AlertTitle>
                  <AlertDescription>{appealContext.error}</AlertDescription>
                </Alert>
              )}

              {!isContextLoading && appealContext && !appealContext.error && (
                <>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                      <HelpCircle className="w-5 h-5" />
                      <h4 className="text-xs font-black uppercase tracking-[0.2em]">Sual:</h4>
                    </div>
                    <Card className="rounded-2xl border-none bg-muted/30 p-6 space-y-4 shadow-inner">
                      <p className="text-lg font-bold text-foreground leading-relaxed">
                        {appealContext.question?.text || "Sual mətni yoxdur."}
                      </p>
                      {appealContext.question?.image && (
                        <div className="rounded-xl overflow-hidden border-2 border-border/50 max-w-md bg-card">
                          <img src={appealContext.question.image} alt="Sual" className="w-full h-auto" />
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4 items-center pt-2">
                        <Badge variant="outline" className="font-mono bg-card text-primary border-primary/20">
                          Növ: {appealContext.question?.type?.toUpperCase()}
                        </Badge>
                        <Badge variant="outline" className="font-mono bg-card text-green-500 border-green-500/20">
                          Sistemin Doğru Cavabı: {appealContext.question?.correctAnswer}
                        </Badge>
                      </div>
                    </Card>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-primary">
                      <User className="w-5 h-5" />
                      <h4 className="text-xs font-black uppercase tracking-[0.2em]">Tələbənin Verdiyi Cavab:</h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card className="rounded-2xl border-none bg-primary/5 p-6 space-y-2 shadow-inner">
                        <span className="text-[10px] font-black text-primary/60 uppercase">Yekun Cavab:</span>
                        <p className="text-2xl font-black text-primary">
                          {appealContext.studentAnswer?.finalAnswer || "Cavab yoxdur"}
                        </p>
                      </Card>
                      <Card className="rounded-2xl border-none bg-muted/50 p-6 space-y-2 shadow-inner">
                        <span className="text-[10px] font-black text-muted-foreground uppercase">Həll Yolu / İzah:</span>
                        <p className="text-sm font-medium italic text-foreground leading-relaxed">
                          "{appealContext.studentAnswer?.explanation || "İzah yazılmayıb."}"
                        </p>
                      </Card>
                    </div>
                  </div>
                </>
              )}

              {selectedAppeal && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary">
                    <FileText className="w-5 h-5" />
                    <h4 className="text-xs font-black uppercase tracking-[0.2em]">Tələbənin Apelyasiya Səbəbi:</h4>
                  </div>
                  <div className="p-6 bg-destructive/5 rounded-2xl font-bold text-foreground italic border-2 border-dashed border-destructive/20 shadow-sm">
                    "{selectedAppeal.studentReason}"
                  </div>
                </div>
              )}

              <div className="space-y-6 pt-10 border-t border-border/50">
                {selectedAppeal?.status === 'pending' ? (
                  <div className="space-y-6">
                    <div className="flex items-center gap-2 text-primary">
                      <Check className="w-5 h-5" />
                      <h4 className="text-xs font-black uppercase tracking-[0.2em]">Qərarınız və Tələbəyə Rəy:</h4>
                    </div>
                    <Textarea 
                      placeholder="Tələbəyə rəyinizi bura yazın..."
                      value={adminComment}
                      onChange={(e) => setAdminComment(e.target.value)}
                      className="min-h-[120px] rounded-2xl bg-muted/20 border-border/50 text-lg shadow-sm"
                    />
                    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                      <Button 
                        className="bg-green-600 hover:bg-green-700 font-black h-14 rounded-2xl text-white shadow-lg" 
                        onClick={() => handleAppealDecision('approved', 1)}
                        disabled={isProcessingAppeal}
                      >
                        +1.00
                      </Button>
                      <Button 
                        className="bg-lime-500 hover:bg-lime-600 font-black h-14 rounded-2xl text-white shadow-lg" 
                        onClick={() => handleAppealDecision('approved', 0.67)}
                        disabled={isProcessingAppeal}
                      >
                        +0.67
                      </Button>
                      <Button 
                        className="bg-lime-400 hover:bg-lime-500 font-black h-14 rounded-2xl text-white shadow-lg" 
                        onClick={() => handleAppealDecision('approved', 0.50)}
                        disabled={isProcessingAppeal}
                      >
                        +0.50
                      </Button>
                      <Button 
                        className="bg-lime-300 hover:bg-lime-400 font-black h-14 rounded-2xl text-white shadow-lg" 
                        onClick={() => handleAppealDecision('approved', 0.33)}
                        disabled={isProcessingAppeal}
                      >
                        +0.33
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
                  <div className="space-y-4">
                    <h4 className="text-xs font-black text-primary uppercase tracking-[0.2em]">Verilən Qərar və Rəy:</h4>
                    <div className="p-6 bg-primary/5 border border-primary/20 rounded-2xl font-bold text-foreground shadow-sm">
                      {selectedAppeal?.adminComment || "Rəy bildirilməyib."}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Badge variant={selectedAppeal?.status === 'approved' ? 'default' : 'destructive'} className="rounded-full px-6 py-2 font-black">
                        {selectedAppeal?.status === 'approved' ? `TƏSDİQLƏNDİ (+${(selectedAppeal?.awardedScore || 0).toFixed(2)})` : 'RƏDD EDİLDİ'}
                      </Badge>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}