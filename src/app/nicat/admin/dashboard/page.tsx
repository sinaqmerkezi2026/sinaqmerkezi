
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
        // Update the student attempt score
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
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-slate-800">İdarəetmə Paneli</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={createNewExam} className="bg-primary hover:bg-primary/90 shadow-md">
            <Plus className="w-4 h-4 mr-2" />
            Yeni İmtahan
          </Button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <Tabs defaultValue="exams" className="space-y-6">
          <TabsList className="bg-white border p-1 rounded-xl shadow-sm">
            <TabsTrigger value="exams" className="rounded-lg px-6">İmtahanlar</TabsTrigger>
            <TabsTrigger value="appeals" className="rounded-lg px-6 gap-2">
              Apelyasiyalar
              {appeals?.filter(a => a.status === 'pending').length > 0 && (
                <Badge variant="destructive" className="h-5 min-w-5 flex items-center justify-center p-0 text-[10px]">
                  {appeals.filter(a => a.status === 'pending').length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="exams">
            {isExamsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-64 w-full rounded-xl" />)}
              </div>
            ) : !exams || exams.length === 0 ? (
              <Card className="border-dashed border-2 py-20 flex flex-col items-center justify-center text-slate-400">
                <Plus className="w-12 h-12 mb-4 opacity-20" />
                <p className="text-lg">Hələ heç bir imtahan yaradılmayan</p>
                <Button variant="link" onClick={createNewExam}>İlk imtahanı yarat</Button>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams.map((exam: any) => (
                  <Card key={exam.id} className="group hover:shadow-lg transition-all border-none bg-white">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors">
                          {exam.name}
                        </CardTitle>
                        <Badge variant="outline" className="font-mono">
                          Aktiv
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-4">
                      <div className="flex items-center text-sm text-slate-500 gap-2">
                        <Calendar className="w-4 h-4" />
                        <span>{exam.activeStartDate} - {exam.activeEndDate}</span>
                      </div>
                      <div className="flex items-center text-sm text-slate-500 gap-2">
                        <Clock className="w-4 h-4" />
                        <span>{exam.durationMinutes} dəqiqə</span>
                      </div>
                      <div className="flex items-center text-sm font-medium text-primary gap-2">
                        <DollarSign className="w-4 h-4" />
                        <span>{exam.price?.toFixed(2)} AZN</span>
                      </div>
                    </CardContent>
                    <CardFooter className="pt-4 border-t">
                      <Button 
                        variant="ghost" 
                        className="w-full text-slate-600 hover:text-primary hover:bg-primary/5"
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
            <Card className="border-none bg-white shadow-sm overflow-hidden">
              <ScrollArea className="h-[70vh]">
                <div className="p-6 space-y-4">
                  {!appeals || appeals.length === 0 ? (
                    <div className="text-center py-20 opacity-30 flex flex-col items-center gap-4">
                      <MessageSquare className="w-16 h-16" />
                      <p className="text-xl font-bold">Hələ heç bir apelyasiya müraciəti yoxdur.</p>
                    </div>
                  ) : (
                    appeals.map((appeal: any) => (
                      <div key={appeal.id} className="flex items-center justify-between p-6 border rounded-2xl hover:bg-slate-50 transition-colors">
                        <div className="space-y-2">
                          <div className="flex items-center gap-3">
                            <span className="font-black text-slate-800">{appeal.studentName}</span>
                            <Badge variant={appeal.status === 'approved' ? 'default' : appeal.status === 'rejected' ? 'destructive' : 'secondary'}>
                              {appeal.status === 'pending' ? 'Gözləmədə' : appeal.status === 'approved' ? `Təsdiqləndi (${appeal.awardedScore})` : 'Rədd edildi'}
                            </Badge>
                          </div>
                          <p className="text-sm text-slate-500 max-w-xl line-clamp-1 italic">"{appeal.studentReason}"</p>
                          <p className="text-[10px] text-slate-400 font-mono">ID: {appeal.id} | {new Date(appeal.createdAt).toLocaleString()}</p>
                        </div>
                        
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" className="rounded-lg" onClick={() => setSelectedAppeal(appeal)}>
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

      {/* Appeal Detail Dialog */}
      <Dialog open={!!selectedAppeal} onOpenChange={(open) => !open && setSelectedAppeal(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Apelyasiya Detalları</DialogTitle>
            <DialogDescription>
              Tələbənin müraciətini dəyərləndirin və müvafiq balı təyin edin.
            </DialogDescription>
          </DialogHeader>
          
          {selectedAppeal && (
            <div className="space-y-6 py-4">
              <div className="space-y-2">
                <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Tələbənin Səbəbi:</h4>
                <div className="p-4 bg-slate-100 rounded-xl font-medium text-slate-800 italic">
                  "{selectedAppeal.studentReason}"
                </div>
              </div>

              {selectedAppeal.status === 'pending' ? (
                <div className="space-y-4">
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Qərarınız və Rəyiniz:</h4>
                  <Textarea 
                    placeholder="Tələbəyə rəyinizi yazın..."
                    value={adminComment}
                    onChange={(e) => setAdminComment(e.target.value)}
                    className="min-h-[100px] rounded-xl"
                  />
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-2">
                    <Button 
                      className="bg-green-600 hover:bg-green-700 font-black h-12" 
                      onClick={() => handleAppealDecision('approved', 1)}
                      disabled={isProcessingAppeal}
                    >
                      +1
                    </Button>
                    <Button 
                      className="bg-green-500 hover:bg-green-600 font-black h-12" 
                      onClick={() => handleAppealDecision('approved', 2/3)}
                      disabled={isProcessingAppeal}
                    >
                      +2/3
                    </Button>
                    <Button 
                      className="bg-green-400 hover:bg-green-500 font-black h-12" 
                      onClick={() => handleAppealDecision('approved', 1/2)}
                      disabled={isProcessingAppeal}
                    >
                      +1/2
                    </Button>
                    <Button 
                      className="bg-green-300 hover:bg-green-400 font-black h-12 text-slate-800" 
                      onClick={() => handleAppealDecision('approved', 1/3)}
                      disabled={isProcessingAppeal}
                    >
                      +1/3
                    </Button>
                    <Button 
                      variant="destructive" 
                      className="font-black h-12" 
                      onClick={() => handleAppealDecision('rejected')}
                      disabled={isProcessingAppeal}
                    >
                      Rədd et
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2 pt-4 border-t">
                  <h4 className="text-sm font-black text-slate-400 uppercase tracking-widest">Sizin Rəyiniz:</h4>
                  <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl font-bold text-primary">
                    {selectedAppeal.adminComment || "Rəy bildirilməyib."}
                  </div>
                  {selectedAppeal.status === 'approved' && (
                    <div className="text-sm font-bold text-green-600 mt-2">
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
