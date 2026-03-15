"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Plus, Calendar, Clock, DollarSign, ListChecks, Edit, LayoutDashboard, Database } from 'lucide-react';
import { db, Exam } from '@/lib/store';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { collection, serverTimestamp } from 'firebase/firestore';
import { addDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from '@/hooks/use-toast';

export default function AdminDashboard() {
  const [exams, setExams] = useState<Exam[]>([]);
  const router = useRouter();
  const firestore = useFirestore();
  const { toast } = useToast();

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') !== 'true') {
      router.push('/nicat/admin/login');
      return;
    }
    setExams(db.getExams());
  }, [router]);

  const createNewExam = () => {
    const id = Math.random().toString(36).substr(2, 9);
    router.push(`/nicat/admin/exam/${id}`);
  };

  const testDatabaseConnection = () => {
    const testRef = collection(firestore, 'test_messages');
    addDocumentNonBlocking(testRef, {
      message: 'hello',
      timestamp: serverTimestamp(),
      sentBy: 'admin'
    });
    
    toast({
      title: "Məlumat göndərildi",
      description: "Firebase Firestore-a 'hello' mesajı göndərildi. Konsoldan yoxlaya bilərsiniz.",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <nav className="bg-white border-b sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold text-slate-800">İdarəetmə Paneli</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={testDatabaseConnection} className="border-primary text-primary hover:bg-primary/5">
            <Database className="w-4 h-4 mr-2" />
            DB Test (Hello)
          </Button>
          <Button onClick={createNewExam} className="bg-primary hover:bg-primary/90 shadow-md">
            <Plus className="w-4 h-4 mr-2" />
            Yeni İmtahan
          </Button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {exams.length === 0 ? (
            <Card className="col-span-full border-dashed border-2 py-20 flex flex-col items-center justify-center text-slate-400">
              <Plus className="w-12 h-12 mb-4 opacity-20" />
              <p className="text-lg">Hələ heç bir imtahan yaradılmayıb</p>
              <Button variant="link" onClick={createNewExam}>İlk imtahanı yarat</Button>
            </Card>
          ) : (
            exams.map((exam) => (
              <Card key={exam.id} className="group hover:shadow-lg transition-all border-none bg-white">
                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <CardTitle className="text-xl font-bold group-hover:text-primary transition-colors">
                      {exam.name}
                    </CardTitle>
                    <Badge variant="outline" className="font-mono">
                      {exam.codes.length} kod
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 pt-4">
                  <div className="flex items-center text-sm text-slate-500 gap-2">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(exam.startDate).toLocaleDateString()} - {new Date(exam.endDate).toLocaleDateString()}</span>
                  </div>
                  <div className="flex items-center text-sm text-slate-500 gap-2">
                    <Clock className="w-4 h-4" />
                    <span>{exam.durationMinutes} dəqiqə</span>
                  </div>
                  <div className="flex items-center text-sm font-medium text-primary gap-2">
                    <DollarSign className="w-4 h-4" />
                    <span>{exam.price.toFixed(2)} AZN</span>
                  </div>
                  <div className="flex items-center text-sm text-slate-500 gap-2">
                    <ListChecks className="w-4 h-4" />
                    <span>{exam.questions.length} sual</span>
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
