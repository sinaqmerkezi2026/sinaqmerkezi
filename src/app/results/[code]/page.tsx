
"use client";

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Award, Share2, ArrowLeft, BrainCircuit, Loader2 } from 'lucide-react';
import { gradeExplanationQuestion } from '@/ai/flows/grade-explanation-question-flow';
import { useFirestore, useMemoFirebase, useCollection } from '@/firebase';
import { collectionGroup, query, where, getDocs, doc, getDoc, updateDoc } from 'firebase/firestore';

export default function Results() {
  const { code } = useParams();
  const router = useRouter();
  const firestore = useFirestore();

  const [exam, setExam] = useState<any>(null);
  const [attempt, setAttempt] = useState<any>(null);
  const [aiFeedbacks, setAiFeedbacks] = useState<Record<string, { score: number, feedback: string }>>({});
  const [isGrading, setIsGrading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!code) return;
      setIsLoading(true);
      try {
        // Find the access code to get examId and studentAttemptId
        const codesRef = collectionGroup(firestore, 'accessCodes');
        const q = query(codesRef, where('code', '==', code.toString().toUpperCase()));
        const querySnapshot = await getDocs(q);

        if (querySnapshot.empty) {
          router.push('/');
          return;
        }

        const codeData = querySnapshot.docs[0].data();
        if (!codeData.studentAttemptId) {
          router.push('/');
          return;
        }

        // Fetch exam data
        const examDoc = await getDoc(doc(firestore, 'exams', codeData.examId));
        // Fetch attempt data
        const attemptDoc = await getDoc(doc(firestore, 'studentAttempts', codeData.studentAttemptId));

        if (!examDoc.exists() || !attemptDoc.exists()) {
          router.push('/');
          return;
        }

        const examData = examDoc.data();
        const attemptData = attemptDoc.data();

        setExam(examData);
        setAttempt(attemptData);

        if (attemptData.results) {
          setAiFeedbacks(attemptData.results);
        } else {
          await gradeExplanations(examData, attemptData);
        }
      } catch (error) {
        console.error("Error fetching results:", error);
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [code, firestore, router]);

  const gradeExplanations = async (e: any, a: any) => {
    setIsGrading(true);
    const feedbacks: Record<string, any> = {};
    
    for (const q of e.questions || []) {
      if (q.type === 'explanation') {
        const studentAns = a.answers?.[q.id];
        if (studentAns?.explanation) {
          try {
            const result = await gradeExplanationQuestion({
              studentExplanation: studentAns.explanation,
              adminExplanationCriterion: q.explanationCriterion || q.correctAnswer
            });
            feedbacks[q.id] = result;
          } catch (err) {
            feedbacks[q.id] = { score: 0, feedback: 'AI qiymətləndirmə zamanı xəta baş verdi.' };
          }
        } else {
          feedbacks[q.id] = { score: 0, feedback: 'İzah daxil edilməyib.' };
        }
      }
    }
    
    setAiFeedbacks(feedbacks);
    
    // Save to Firestore
    try {
      const attemptRef = doc(firestore, 'studentAttempts', a.id);
      await updateDoc(attemptRef, { results: feedbacks });
    } catch (e) {
      console.error("Failed to save AI results:", e);
    }
    
    setIsGrading(false);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-slate-500 font-medium">Nəticələr yüklənir...</p>
        </div>
      </div>
    );
  }

  if (!exam || !attempt) return null;

  const calculateTotalScore = () => {
    let score = 0;
    const questions = exam.questions || [];
    questions.forEach((q: any) => {
      const ans = attempt.answers?.[q.id];
      if (!ans) return;

      if (q.type === 'mcq' || q.type === 'open') {
        if (ans.finalAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase()) {
          score += 1;
        }
      } else if (q.type === 'explanation') {
        const finalCorrect = ans.finalAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();
        const aiResult = aiFeedbacks[q.id];
        if (finalCorrect && aiResult) {
          score += aiResult.score;
        }
      }
    });
    return questions.length > 0 ? (score / questions.length) * 100 : 0;
  };

  const totalScore = calculateTotalScore();

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="flex justify-between items-center">
          <Button variant="ghost" onClick={() => router.push('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Ana Səhifə
          </Button>
          <Button variant="outline">
            <Share2 className="w-4 h-4 mr-2" />
            Nəticəni paylaş
          </Button>
        </header>

        <Card className="border-none shadow-2xl bg-gradient-to-br from-primary to-primary/80 text-white text-center py-10 px-6">
          <div className="mx-auto bg-white/20 p-4 rounded-full w-fit mb-6">
            <Award className="w-16 h-16" />
          </div>
          <CardTitle className="text-4xl font-bold mb-2">Təbriklər!</CardTitle>
          <CardDescription className="text-primary-foreground/80 text-lg">
            {attempt.studentFirstName} {attempt.studentLastName}, imtahanı tamamladınız.
          </CardDescription>
          <div className="mt-8">
            <div className="text-7xl font-black mb-2">{Math.round(totalScore)}%</div>
            <div className="text-sm uppercase tracking-widest opacity-80">Ümumi Müvəffəqiyyət</div>
          </div>
        </Card>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-6">
            <h3 className="text-slate-500 text-sm font-bold uppercase mb-4">Statistika</h3>
            <div className="space-y-4">
              {(exam.questions || []).map((q: any, i: number) => {
                const ans = attempt.answers?.[q.id];
                const isCorrect = ans?.finalAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase();
                return (
                  <div key={q.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-slate-700 font-medium">Sual {i + 1}</span>
                    <div className="flex items-center gap-2">
                      {q.type === 'explanation' ? (
                        <div className="flex items-center gap-2">
                          {isCorrect ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <XCircle className="w-4 h-4 text-red-500" />}
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                            AI: {aiFeedbacks[q.id]?.score !== undefined ? `${(aiFeedbacks[q.id].score * 100).toFixed(0)}%` : '...'}
                          </span>
                        </div>
                      ) : (
                        isCorrect ? <CheckCircle2 className="w-5 h-5 text-green-500" /> : <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-slate-500 text-sm font-bold uppercase mb-4">İzahlı Suallar (AI Feedback)</h3>
            <div className="space-y-6">
              {isGrading ? (
                <div className="flex flex-col items-center justify-center py-10 text-slate-400">
                  <BrainCircuit className="w-10 h-10 mb-2 animate-bounce" />
                  <p>AI izahları yoxlayır...</p>
                </div>
              ) : (
                (exam.questions || []).filter((q: any) => q.type === 'explanation').map((q: any) => (
                  <div key={q.id} className="bg-slate-50 p-4 rounded-xl border space-y-3">
                    <p className="font-bold text-sm">Sual: {q.text.substring(0, 50)}...</p>
                    <div className="flex justify-between items-center text-xs">
                      <span className="bg-white px-2 py-1 rounded border">
                        Son cavab: {attempt.answers?.[q.id]?.finalAnswer?.trim().toLowerCase() === q.correctAnswer?.trim().toLowerCase() ? '✅ Doğru' : '❌ Yanlış'}
                      </span>
                      <span className="font-bold text-primary">Bal: {aiFeedbacks[q.id]?.score !== undefined ? (aiFeedbacks[q.id].score * 100).toFixed(0) : 0}%</span>
                    </div>
                    <div className="bg-white p-3 rounded border text-xs leading-relaxed text-slate-600">
                      <p className="font-bold mb-1 text-primary flex items-center gap-1">
                        <BrainCircuit className="w-3 h-3" /> AI Rəyi:
                      </p>
                      {aiFeedbacks[q.id]?.feedback || 'Qiymətləndirilməyib.'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
