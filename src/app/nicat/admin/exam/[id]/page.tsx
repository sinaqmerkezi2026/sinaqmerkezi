
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Save, Plus, Trash2, ArrowLeft, Key, ImageIcon, Copy, Check, Hash, Ticket, UserCheck, Layers } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where, orderBy } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { ThemeToggle } from '@/components/ThemeToggle';

type QuestionType = 'mcq' | 'open' | 'explanation';

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  image?: string;
  options?: string[];
  correctAnswer: string;
  explanationCriterion?: string;
}

interface Exam {
  id: string;
  name: string;
  activeStartDate: string;
  activeEndDate: string;
  durationMinutes: number;
  price: number;
  codes: string[];
  questions: Question[];
  categoryId?: string;
}

export default function ExamEditor() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const [examState, setExamState] = useState<Partial<Exam>>({
    id: id as string,
    name: '',
    activeStartDate: new Date().toISOString().split('T')[0],
    activeEndDate: new Date(Date.now() + 31536000000).toISOString().split('T')[0],
    durationMinutes: 60,
    price: 1,
    codes: [],
    questions: [],
    categoryId: ""
  });

  const examRef = useMemoFirebase(() => doc(firestore, 'exams', id as string), [firestore, id]);
  const { data: existingExam } = useDoc(examRef);

  const categoriesQuery = useMemoFirebase(() => query(collection(firestore, 'categories'), orderBy('name')), [firestore]);
  const { data: categories } = useCollection(categoriesQuery);

  const codesQuery = useMemoFirebase(() => 
    query(collection(firestore, 'accessCodes'), where('examId', '==', id)),
    [firestore, id]
  );
  const { data: dbCodes } = useCollection(codesQuery);

  const availableCodes = (dbCodes || []).filter(c => !c.isUsedForEntry);
  const usedCodes = (dbCodes || []).filter(c => c.isUsedForEntry);

  useEffect(() => {
    if (localStorage.getItem('admin_auth') !== 'true') {
      router.push('/nicat/admin/login');
    } else {
      setIsAuthenticated(true);
    }
    
    if (existingExam) {
      setExamState(existingExam);
    }
  }, [existingExam, router]);

  const addQuestion = () => {
    const q: Question = {
      id: Math.random().toString(36).substr(2, 9),
      type: 'mcq',
      text: '',
      options: ['', '', '', '', ''],
      correctAnswer: '',
    };
    setExamState(prev => ({ ...prev, questions: [...(prev.questions || []), q] }));
  };

  const removeQuestion = (qId: string) => {
    setExamState(prev => ({ ...prev, questions: prev.questions?.filter(q => q.id !== qId) }));
  };

  const updateQuestion = (qId: string, updates: Partial<Question>) => {
    setExamState(prev => ({
      ...prev,
      questions: prev.questions?.map(q => q.id === qId ? { ...q, ...updates } : q)
    }));
  };

  const generateCodes = () => {
    const codes = Array.from({ length: 100 }, () => 
      Math.random().toString(36).substr(2, 6).toUpperCase()
    );
    setExamState(prev => ({ ...prev, codes: [...(prev.codes || []), ...codes] }));
    toast({ title: 'Uğurlu', description: '100 ədəd yeni unikal kod siyahıya əlavə edildi.' });
  };

  const handleSave = () => {
    if (!examState.name || (examState.codes?.length || 0) === 0) {
      toast({ title: 'Xəta', description: 'İmtahan adı və kodlar mütləqdir.', variant: 'destructive' });
      return;
    }

    setDocumentNonBlocking(examRef, examState, { merge: true });

    examState.codes?.forEach(code => {
      const codeRef = doc(firestore, 'accessCodes', code);
      setDocumentNonBlocking(codeRef, {
        id: code,
        code: code,
        examId: id as string,
        isUsedForEntry: dbCodes?.find(db => db.code === code)?.isUsedForEntry || false,
        studentAttemptId: dbCodes?.find(db => db.code === code)?.studentAttemptId || null
      }, { merge: true });
    });

    toast({ title: 'Uğurlu', description: 'İmtahan və kodlar bazaya yazıldı.' });
    router.push('/nicat/admin/dashboard');
  };

  if (!isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background pb-20 font-body">
      <nav className="bg-card/80 backdrop-blur-md border-b sticky top-0 z-10 px-6 py-4 flex justify-between items-center shadow-sm">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-black text-foreground tracking-tight">İmtahan Redaktoru</h1>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button variant="outline" onClick={generateCodes} className="hidden sm:flex rounded-xl font-bold bg-background border-border/50">
            <Key className="w-4 h-4 mr-2" />
            Yeni Kodlar (+100)
          </Button>
          <Button onClick={handleSave} className="rounded-xl font-black shadow-lg text-white">
            <Save className="w-4 h-4 mr-2" />
            Yadda saxla
          </Button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6 space-y-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-8 space-y-10">
            <Card className="border-none shadow-xl bg-card/50 backdrop-blur-sm rounded-[2.5rem] overflow-hidden">
              <CardHeader className="p-8 border-b border-border/50 bg-muted/20">
                <CardTitle className="text-2xl font-black">Əsas Məlumatlar</CardTitle>
              </CardHeader>
              <CardContent className="p-8 grid gap-6 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <Label className="text-sm font-black text-muted-foreground uppercase tracking-widest px-1">İmtahan Adı</Label>
                  <Input 
                    value={examState.name} 
                    onChange={e => setExamState(p => ({ ...p, name: e.target.value }))} 
                    placeholder="Məs: Riyaziyyat - Blok İmtahanı" 
                    className="h-12 rounded-xl bg-muted/20 border-border/50 text-lg font-bold"
                  />
                </div>
                
                <div className="sm:col-span-2 space-y-2">
                  <Label className="text-sm font-black text-muted-foreground uppercase tracking-widest px-1">Kateqoriya</Label>
                  <Select value={examState.categoryId} onValueChange={(val) => setExamState(p => ({ ...p, categoryId: val }))}>
                    <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-border/50 font-bold">
                      <SelectValue placeholder="Kateqoriya seçin" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Kateqoriya yoxdur</SelectItem>
                      {categories?.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-black text-muted-foreground uppercase tracking-widest px-1">Başlanğıc Tarixi</Label>
                  <Input type="date" value={examState.activeStartDate} onChange={e => setExamState(p => ({ ...p, activeStartDate: e.target.value }))} className="h-12 rounded-xl bg-muted/20 border-border/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-black text-muted-foreground uppercase tracking-widest px-1">Bitmə Tarixi</Label>
                  <Input type="date" value={examState.activeEndDate} onChange={e => setExamState(p => ({ ...p, activeEndDate: e.target.value }))} className="h-12 rounded-xl bg-muted/20 border-border/50" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-black text-muted-foreground uppercase tracking-widest px-1">Müddət (dəqiqə)</Label>
                  <Input type="number" value={examState.durationMinutes} onChange={e => setExamState(p => ({ ...p, durationMinutes: parseInt(e.target.value) }))} className="h-12 rounded-xl bg-muted/20 border-border/50 text-lg font-bold" />
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-black text-muted-foreground uppercase tracking-widest px-1">Qiymət (AZN)</Label>
                  <Input type="number" step="0.1" value={examState.price} onChange={e => setExamState(p => ({ ...p, price: parseFloat(e.target.value) }))} className="h-12 rounded-xl bg-muted/20 border-border/50 text-lg font-bold text-primary" />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <div className="flex justify-between items-center px-4">
                <h2 className="text-2xl font-black text-foreground">Suallar <span className="text-primary">({examState.questions?.length || 0})</span></h2>
                <Button size="sm" onClick={addQuestion} className="rounded-xl font-bold shadow-md">
                  <Plus className="w-4 h-4 mr-2" />
                  Sual əlavə et
                </Button>
              </div>

              {examState.questions?.map((q, idx) => (
                <Card key={q.id} className="relative group border-none shadow-xl bg-card/50 backdrop-blur-sm rounded-[2rem] overflow-hidden hover:ring-2 ring-primary/20 transition-all">
                  <CardContent className="pt-8 p-8 space-y-6">
                    <div className="flex justify-between items-start gap-6">
                      <div className="flex-1 space-y-6">
                        <div className="flex gap-4">
                          <Select value={q.type} onValueChange={(val: QuestionType) => updateQuestion(q.id, { type: val })}>
                            <SelectTrigger className="w-[220px] h-11 rounded-xl bg-muted/30 border-border/50 font-bold">
                              <SelectValue placeholder="Sual növü" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mcq">Qapalı (Test)</SelectItem>
                              <SelectItem value="open">Açıq</SelectItem>
                              <SelectItem value="explanation">İzahlı (AI)</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl bg-muted/30 border-border/50" onClick={() => {
                            const url = prompt("Şəkil URL-i daxil edin:");
                            if (url) updateQuestion(q.id, { image: url });
                          }}>
                            <ImageIcon className="w-5 h-5" />
                          </Button>
                        </div>

                        <Textarea 
                          placeholder={`Sual ${idx + 1} mətnini daxil edin...`} 
                          value={q.text} 
                          onChange={e => updateQuestion(q.id, { text: e.target.value })}
                          className="min-h-[120px] rounded-2xl bg-muted/20 border-border/50 text-lg font-bold leading-relaxed"
                        />

                        {q.image && (
                          <div className="relative w-full max-w-sm aspect-video border-4 border-muted/50 rounded-[1.5rem] overflow-hidden bg-muted/10 group/img">
                            <img src={q.image} alt="Sual şəkli" className="object-cover w-full h-full transition-transform duration-500 group-hover/img:scale-105" />
                            <button onClick={() => updateQuestion(q.id, { image: undefined })} className="absolute top-3 right-3 bg-destructive text-white rounded-full p-2 shadow-xl opacity-0 group-hover/img:opacity-100 transition-opacity">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {q.type === 'mcq' && (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {q.options?.map((opt, oIdx) => (
                              <div key={oIdx} className="flex gap-2">
                                <div className="flex-1 relative group/opt">
                                  <div className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-black text-muted-foreground group-focus-within/opt:bg-primary group-focus-within/opt:text-white transition-colors">
                                    {String.fromCharCode(65 + oIdx)}
                                  </div>
                                  <Input 
                                    placeholder={`Variant ${String.fromCharCode(65 + oIdx)}`} 
                                    value={opt} 
                                    onChange={e => {
                                      const newOpts = [...(q.options || [])];
                                      newOpts[oIdx] = e.target.value;
                                      updateQuestion(q.id, { options: newOpts });
                                    }}
                                    className="pl-14 h-12 rounded-xl bg-muted/20 border-border/50 font-bold"
                                  />
                                </div>
                                <Button 
                                  size="icon" 
                                  variant={q.correctAnswer === opt && opt !== '' ? 'default' : 'outline'}
                                  onClick={() => updateQuestion(q.id, { correctAnswer: opt })}
                                  className="h-12 w-12 rounded-xl"
                                >
                                  <Check className="w-5 h-5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.type === 'open' && (
                          <div className="space-y-2">
                            <Label className="text-xs font-black text-primary uppercase tracking-widest px-1">Düzgün Cavab</Label>
                            <Input 
                              placeholder="Doğru cavabı bura daxil edin..." 
                              value={q.correctAnswer} 
                              onChange={e => updateQuestion(q.id, { correctAnswer: e.target.value })}
                              className="h-12 rounded-xl bg-primary/5 border-primary/20 text-lg font-black text-primary text-center"
                            />
                          </div>
                        )}

                        {q.type === 'explanation' && (
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label className="text-xs font-black text-primary uppercase tracking-widest px-1">Yekun Doğru Cavab</Label>
                              <Input 
                                placeholder="Doğru son cavab..." 
                                value={q.correctAnswer} 
                                onChange={e => updateQuestion(q.id, { correctAnswer: e.target.value })}
                                className="h-12 rounded-xl bg-primary/5 border-primary/20 text-lg font-black text-primary text-center"
                              />
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs font-black text-muted-foreground uppercase tracking-widest px-1">İzah Qiymətləndirmə Meyarı</Label>
                              <Textarea 
                                placeholder="AI bu mətni əsas götürərək tələbənin izahını ballandıracaq..." 
                                value={q.explanationCriterion}
                                onChange={e => updateQuestion(q.id, { explanationCriterion: e.target.value })}
                                className="min-h-[100px] rounded-xl bg-muted/20 border-border/50"
                              />
                            </div>
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10 rounded-xl mt-1" onClick={() => removeQuestion(q.id)}>
                        <Trash2 className="w-5 h-5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="lg:col-span-4 space-y-8">
            <Card className="sticky top-28 shadow-2xl border-none bg-card/50 backdrop-blur-sm rounded-[2.5rem] overflow-hidden">
              <CardHeader className="bg-primary/5 border-b border-border/50 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-xl">
                      <Hash className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-xl font-black">Giriş Kodları</CardTitle>
                  </div>
                  <Badge className="bg-primary text-white font-black rounded-full px-3">{examState.codes?.length || 0}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="available" className="w-full">
                  <TabsList className="w-full rounded-none h-14 bg-muted/30 border-b border-border/50">
                    <TabsTrigger value="available" className="flex-1 gap-2 font-black data-[state=active]:bg-card data-[state=active]:text-primary">
                      <Ticket className="w-4 h-4" />
                      Mövcud ({availableCodes.length})
                    </TabsTrigger>
                    <TabsTrigger value="used" className="flex-1 gap-2 font-black data-[state=active]:bg-card data-[state=active]:text-primary">
                      <UserCheck className="w-4 h-4" />
                      İşlənmiş ({usedCodes.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="available" className="m-0">
                    <ScrollArea className="h-[550px] p-6">
                      {availableCodes.length > 0 ? (
                        <div className="grid grid-cols-2 gap-3">
                          {availableCodes.map((codeDoc) => (
                            <div 
                              key={codeDoc.id} 
                              className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/50 hover:border-primary/50 transition-all group"
                            >
                              <span className="font-mono text-sm font-black text-foreground">{codeDoc.code}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 opacity-20">
                          <Ticket className="w-20 h-20 text-muted-foreground" />
                          <p className="text-xl font-black">Mövcud kod yoxdur.</p>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="used" className="m-0">
                    <ScrollArea className="h-[550px] p-6">
                      {usedCodes.length > 0 ? (
                        <div className="space-y-3">
                          {usedCodes.map((codeDoc) => (
                            <div 
                              key={codeDoc.id} 
                              className="flex items-center justify-between p-4 rounded-2xl bg-muted/10 border border-border/50"
                            >
                              <span className="font-mono text-sm font-black text-muted-foreground line-through decoration-destructive/50">{codeDoc.code}</span>
                              <Badge variant="outline" className="bg-green-500/10 text-green-500 border-green-500/20 font-black">
                                İŞLƏNİB
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-24 text-center space-y-6 opacity-20">
                          <UserCheck className="w-20 h-20 text-muted-foreground" />
                          <p className="text-xl font-black">Hələ heç bir kod istifadə olunmayıb.</p>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
