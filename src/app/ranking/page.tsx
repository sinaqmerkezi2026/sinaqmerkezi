
"use client";

import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trophy, Medal, ArrowLeft, Loader2, GraduationCap, Crown } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export default function RankingPage() {
  const router = useRouter();
  const firestore = useFirestore();

  // Reytinq sorğusunu optimallaşdırırıq. 
  // Qeyd: totalScore sahəsi olmayan sənədlər siyahıya düşməyəcək.
  const rankingQuery = useMemoFirebase(() => {
    const colRef = collection(firestore, 'studentAttempts');
    return query(
      colRef,
      where('isCompleted', '==', true),
      orderBy('totalScore', 'desc'),
      limit(50)
    );
  }, [firestore]);

  const { data: rankings, isLoading, error } = useCollection(rankingQuery);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-6">
          <Loader2 className="w-16 h-16 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground font-black text-xl">Liderlər Lövhəsi yüklənir...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-6 font-body pb-20">
      <div className="max-w-4xl mx-auto space-y-12">
        <header className="flex justify-between items-center sticky top-0 z-50 bg-background/80 backdrop-blur-md py-4">
          <Button variant="ghost" onClick={() => router.push('/')} className="rounded-xl font-bold hover:bg-muted shadow-sm border border-transparent">
            <ArrowLeft className="w-5 h-5 mr-2" />
            Geri
          </Button>
          <div className="flex items-center gap-3">
            <ThemeToggle />
          </div>
        </header>

        <div className="text-center space-y-4">
          <div className="inline-flex items-center justify-center p-6 bg-primary/10 rounded-[2.5rem] mb-4 animate-bounce">
            <Crown className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-5xl font-black tracking-tight text-foreground">
            Liderlər <span className="text-primary">Lövhəsi</span>
          </h1>
          <p className="text-muted-foreground font-medium text-lg max-w-lg mx-auto">
            Sınaq Mərkəzinin ən uğurlu tələbələri və rəsmi reytinq cədvəli.
          </p>
        </div>

        <div className="space-y-6">
          {error ? (
            <Card className="p-12 text-center border-destructive/20 bg-destructive/5 rounded-[2rem]">
              <p className="text-destructive font-bold text-lg">Məlumatları yükləyərkən xəta baş verdi.</p>
              <p className="text-sm text-muted-foreground mt-2">Zəhmət olmasa bir az sonra yenidən cəhd edin.</p>
            </Card>
          ) : !rankings || rankings.length === 0 ? (
            <Card className="border-dashed border-4 py-24 flex flex-col items-center justify-center text-muted-foreground bg-transparent rounded-[3rem]">
              <Trophy className="w-16 h-16 mb-4 opacity-10" />
              <p className="text-xl font-bold">Hələ heç bir nəticə yoxdur</p>
            </Card>
          ) : (
            <div className="space-y-4">
              {rankings.map((attempt: any, index: number) => {
                const isTop1 = index === 0;
                const isTop2 = index === 1;
                const isTop3 = index === 2;
                const isTopThree = isTop1 || isTop2 || isTop3;

                return (
                  <Card 
                    key={attempt.id} 
                    className={cn(
                      "group border-none shadow-xl transition-all duration-300 rounded-[2rem] overflow-hidden",
                      isTop1 ? "bg-gradient-to-r from-yellow-500/20 via-yellow-500/5 to-transparent border-l-8 border-yellow-500 ring-2 ring-yellow-500/20" : 
                      isTop2 ? "bg-gradient-to-r from-slate-300/20 via-slate-300/5 to-transparent border-l-8 border-slate-400" :
                      isTop3 ? "bg-gradient-to-r from-orange-400/20 via-orange-400/5 to-transparent border-l-8 border-orange-500" :
                      "bg-card/50 backdrop-blur-sm hover:translate-x-2"
                    )}
                  >
                    <CardContent className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-6">
                        <div className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl shadow-inner",
                          isTop1 ? "bg-yellow-500 text-white" :
                          isTop2 ? "bg-slate-400 text-white" :
                          isTop3 ? "bg-orange-500 text-white" :
                          "bg-muted text-muted-foreground"
                        )}>
                          {index + 1}
                        </div>
                        
                        <div className="flex items-center gap-4">
                          <Avatar className="h-14 w-14 border-2 border-background shadow-lg">
                            <AvatarFallback className={cn(
                              "font-black text-lg",
                              isTopThree ? "bg-primary text-white" : "bg-muted text-muted-foreground"
                            )}>
                              {attempt.studentFirstName?.[0]}{attempt.studentLastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex flex-col">
                            <span className="font-black text-lg text-foreground flex items-center gap-2">
                              {attempt.studentFirstName} {attempt.studentLastName}
                              {isTop1 && <Trophy className="w-5 h-5 text-yellow-500 fill-yellow-500" />}
                              {isTop2 && <Medal className="w-5 h-5 text-slate-400 fill-slate-400" />}
                              {isTop3 && <Medal className="w-5 h-5 text-orange-500 fill-orange-500" />}
                            </span>
                            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest flex items-center gap-1">
                              <GraduationCap className="w-3 h-3" />
                              Sessiya ID: {attempt.id.substring(0, 6)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right flex flex-col items-end gap-1">
                        <div className={cn(
                          "text-3xl font-black tabular-nums",
                          isTop1 ? "text-yellow-500" : isTopThree ? "text-primary" : "text-foreground"
                        )}>
                          {Math.round(attempt.totalScore || 0)}%
                        </div>
                        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black">
                          {attempt.totalScore > 80 ? 'Əla' : attempt.totalScore > 50 ? 'Yaxşı' : 'Kafi'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
