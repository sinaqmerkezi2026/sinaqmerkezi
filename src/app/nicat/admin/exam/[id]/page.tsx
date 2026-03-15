
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Save, Plus, Trash2, ArrowLeft, Key, ImageIcon, Copy, Check, Hash, Ticket, UserCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useFirestore, useDoc, useMemoFirebase, useCollection } from '@/firebase';
import { doc, collection, query, where } from 'firebase/firestore';
import { setDocumentNonBlocking } from '@/firebase/non-blocking-updates';

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
}

export default function ExamEditor() {
  const { id } = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const firestore = useFirestore();
  
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [examState, setExamState] = useState<Partial<Exam>>({
    id: id as string,
    name: '',
    activeStartDate: new Date().toISOString().split('T')[0],
    activeEndDate: new Date(Date.now() + 31536000000).toISOString().split('T')[0],
    durationMinutes: 60,
    price: 1,
    codes: [],
    questions: []
  });

  const examRef = useMemoFirebase(() => doc(firestore, 'exams', id as string), [firestore, id]);
  const { data: existingExam } = useDoc(examRef);

  // Fetch all access codes for this exam to see usage status
  const codesQuery = useMemoFirebase(() => 
    query(collection(firestore, 'accessCodes'), where('examId', '==', id)),
    [firestore, id]
  );
  const { data: dbCodes } = useCollection(codesQuery);

  const availableCodes = (dbCodes || []).filter(c => !c.isUsedForEntry);
  const usedCodes = (dbCodes || []).filter(c => c.isUsedForEntry);

  useEffect(() => {
    if (sessionStorage.getItem('admin_auth') !== 'true') {
      router.push('/nicat/admin/login');
      return;
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
      options: ['', '', '', ''],
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
    toast({ title: 'Kopyalandı', description: `${text} kodu kopyalandı.` });
  };

  const handleSave = () => {
    if (!examState.name || (examState.codes?.length || 0) === 0) {
      toast({ title: 'Xəta', description: 'İmtahan adı və kodlar mütləqdir.', variant: 'destructive' });
      return;
    }

    // Save exam to Firestore
    setDocumentNonBlocking(examRef, examState, { merge: true });

    // Save codes to a flat collection for easier lookup
    examState.codes?.forEach(code => {
      const codeRef = doc(firestore, 'accessCodes', code);
      setDocumentNonBlocking(codeRef, {
        id: code,
        code: code,
        examId: id as string,
        // Don't overwrite isUsedForEntry if it already exists in the DB
        isUsedForEntry: dbCodes?.find(db => db.code === code)?.isUsedForEntry || false,
        studentAttemptId: dbCodes?.find(db => db.code === code)?.studentAttemptId || null
      }, { merge: true });
    });

    toast({ title: 'Uğurlu', description: 'İmtahan və kodlar bazaya yazıldı.' });
    router.push('/nicat/admin/dashboard');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <nav className="bg-white border-b sticky top-0 z-10 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">İmtahan Redaktoru</h1>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={generateCodes} className="hidden sm:flex">
            <Key className="w-4 h-4 mr-2" />
            Yeni Kodlar Yarat (+100)
          </Button>
          <Button onClick={handleSave}>
            <Save className="w-4 h-4 mr-2" />
            Yadda saxla
          </Button>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto p-6 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <Card>
              <CardHeader>
                <CardTitle>Əsas Məlumatlar</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2 space-y-2">
                  <Label>İmtahan Adı</Label>
                  <Input value={examState.name} onChange={e => setExamState(p => ({ ...p, name: e.target.value }))} placeholder="Məs: Riyaziyyat - Blok İmtahanı" />
                </div>
                <div className="space-y-2">
                  <Label>Başlanğıc Tarixi</Label>
                  <Input type="date" value={examState.activeStartDate} onChange={e => setExamState(p => ({ ...p, activeStartDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Bitmə Tarixi</Label>
                  <Input type="date" value={examState.activeEndDate} onChange={e => setExamState(p => ({ ...p, activeEndDate: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Müddət (dəqiqə)</Label>
                  <Input type="number" value={examState.durationMinutes} onChange={e => setExamState(p => ({ ...p, durationMinutes: parseInt(e.target.value) }))} />
                </div>
                <div className="space-y-2">
                  <Label>Qiymət (AZN)</Label>
                  <Input type="number" step="0.1" value={examState.price} onChange={e => setExamState(p => ({ ...p, price: parseFloat(e.target.value) }))} />
                </div>
              </CardContent>
            </Card>

            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-bold">Suallar ({examState.questions?.length || 0})</h2>
                <Button size="sm" onClick={addQuestion}>
                  <Plus className="w-4 h-4 mr-2" />
                  Sual əlavə et
                </Button>
              </div>

              {examState.questions?.map((q, idx) => (
                <Card key={q.id} className="relative group">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex-1 space-y-4">
                        <div className="flex gap-4">
                          <Select value={q.type} onValueChange={(val: QuestionType) => updateQuestion(q.id, { type: val })}>
                            <SelectTrigger className="w-[200px]">
                              <SelectValue placeholder="Sual növü" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="mcq">Qapalı (Test)</SelectItem>
                              <SelectItem value="open">Açıq</SelectItem>
                              <SelectItem value="explanation">İzahlı (AI)</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button variant="outline" size="icon" onClick={() => {
                            const url = prompt("Şəkil URL-i daxil edin:");
                            if (url) updateQuestion(q.id, { image: url });
                          }}>
                            <ImageIcon className="w-4 h-4" />
                          </Button>
                        </div>

                        <Textarea 
                          placeholder={`Sual ${idx + 1}...`} 
                          value={q.text} 
                          onChange={e => updateQuestion(q.id, { text: e.target.value })}
                        />

                        {q.image && (
                          <div className="relative w-40 h-24 border rounded overflow-hidden">
                            <img src={q.image} alt="Sual şəkli" className="object-cover w-full h-full" />
                            <button onClick={() => updateQuestion(q.id, { image: undefined })} className="absolute top-1 right-1 bg-white rounded-full p-1 shadow">
                              <Trash2 className="w-3 h-3 text-red-500" />
                            </button>
                          </div>
                        )}

                        {q.type === 'mcq' && (
                          <div className="grid grid-cols-2 gap-2">
                            {q.options?.map((opt, oIdx) => (
                              <div key={oIdx} className="flex gap-2">
                                <Input 
                                  placeholder={`Variant ${String.fromCharCode(65 + oIdx)}`} 
                                  value={opt} 
                                  onChange={e => {
                                    const newOpts = [...(q.options || [])];
                                    newOpts[oIdx] = e.target.value;
                                    updateQuestion(q.id, { options: newOpts });
                                  }}
                                />
                                <Button 
                                  size="sm" 
                                  variant={q.correctAnswer === opt && opt !== '' ? 'default' : 'outline'}
                                  onClick={() => updateQuestion(q.id, { correctAnswer: opt })}
                                >
                                  Düz
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {q.type === 'open' && (
                          <Input 
                            placeholder="Doğru cavab..." 
                            value={q.correctAnswer} 
                            onChange={e => updateQuestion(q.id, { correctAnswer: e.target.value })}
                          />
                        )}

                        {q.type === 'explanation' && (
                          <div className="space-y-2">
                            <Input 
                              placeholder="Doğru son cavab..." 
                              value={q.correctAnswer} 
                              onChange={e => updateQuestion(q.id, { correctAnswer: e.target.value })}
                            />
                            <Label className="text-xs text-muted-foreground">İzah meyarı (AI bu mətni əsas götürəcək)</Label>
                            <Textarea 
                              placeholder="Meyar..." 
                              value={q.explanationCriterion}
                              onChange={e => updateQuestion(q.id, { explanationCriterion: e.target.value })}
                            />
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="icon" className="text-red-500 hover:bg-red-50" onClick={() => removeQuestion(q.id)}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <Card className="sticky top-24 shadow-md border-primary/10 overflow-hidden">
              <CardHeader className="bg-primary/5 pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Hash className="w-5 h-5 text-primary" />
                    <CardTitle className="text-lg">Giriş Kodları</CardTitle>
                  </div>
                  <Badge variant="outline" className="bg-white">{examState.codes?.length || 0}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <Tabs defaultValue="available" className="w-full">
                  <TabsList className="w-full rounded-none h-12 bg-slate-50 border-b">
                    <TabsTrigger value="available" className="flex-1 gap-2 data-[state=active]:bg-white">
                      <Ticket className="w-4 h-4" />
                      Mövcud
                      <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                        {availableCodes.length}
                      </Badge>
                    </TabsTrigger>
                    <TabsTrigger value="used" className="flex-1 gap-2 data-[state=active]:bg-white">
                      <UserCheck className="w-4 h-4" />
                      İstifadə olunub
                      <Badge variant="secondary" className="ml-1 px-1.5 py-0 h-5 min-w-5 flex items-center justify-center">
                        {usedCodes.length}
                      </Badge>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="available" className="m-0">
                    <ScrollArea className="h-[500px] p-4">
                      {availableCodes.length > 0 ? (
                        <div className="grid grid-cols-2 gap-2">
                          {availableCodes.map((codeDoc) => (
                            <div 
                              key={codeDoc.id} 
                              className="flex items-center justify-between p-2 rounded-lg bg-white border hover:border-primary/30 transition-all group"
                            >
                              <span className="font-mono text-sm font-bold text-slate-700">{codeDoc.code}</span>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                                onClick={() => copyToClipboard(codeDoc.code)}
                              >
                                {copiedCode === codeDoc.code ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 px-6 opacity-40">
                          <Ticket className="w-12 h-12 text-slate-300" />
                          <p className="text-sm">Mövcud kod yoxdur.</p>
                        </div>
                      )}
                    </ScrollArea>
                  </TabsContent>

                  <TabsContent value="used" className="m-0">
                    <ScrollArea className="h-[500px] p-4">
                      {usedCodes.length > 0 ? (
                        <div className="grid grid-cols-1 gap-2">
                          {usedCodes.map((codeDoc) => (
                            <div 
                              key={codeDoc.id} 
                              className="flex items-center justify-between p-3 rounded-lg bg-slate-50 border border-slate-200"
                            >
                              <div className="flex flex-col">
                                <span className="font-mono text-sm font-bold text-slate-400 line-through">{codeDoc.code}</span>
                                <span className="text-[10px] text-primary font-medium">Sessiya: {codeDoc.studentAttemptId}</span>
                              </div>
                              <Badge variant="outline" className="bg-white text-green-600 border-green-200">
                                İşlənib
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 px-6 opacity-40">
                          <UserCheck className="w-12 h-12 text-slate-300" />
                          <p className="text-sm">Hələ heç bir kod istifadə olunmayıb.</p>
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
