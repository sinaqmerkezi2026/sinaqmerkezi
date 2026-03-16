"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Lock, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Nicat_2010') {
      sessionStorage.setItem('admin_auth', 'true');
      toast({ title: 'Xoş gəldiniz', description: 'İdarəetmə panelinə yönləndirilirsiniz...' });
      router.push('/nicat/admin/dashboard');
    } else {
      toast({ title: 'Giriş rədd edildi', description: 'Şifrə yanlışdır. Yenidən cəhd edin.', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-[-20%] left-[-20%] w-[60%] h-[60%] bg-primary/10 rounded-full blur-[150px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[60%] h-[60%] bg-primary/5 rounded-full blur-[150px] animate-pulse" />

      <div className="absolute top-8 right-8 z-50">
        <ThemeToggle />
      </div>

      <Card className="w-full max-w-md border-none bg-card/40 backdrop-blur-2xl shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] rounded-[3rem] overflow-hidden relative z-10 border border-white/5">
        <CardHeader className="text-center pt-12 pb-8">
          <div className="mx-auto bg-primary/20 p-5 rounded-[2rem] w-fit mb-6 shadow-2xl relative">
            <Lock className="w-10 h-10 text-primary" />
            <Sparkles className="w-5 h-5 text-yellow-500 absolute -top-1 -right-1 animate-bounce" />
          </div>
          <CardTitle className="text-4xl font-black tracking-tight text-foreground">Admin Girişi</CardTitle>
          <CardDescription className="text-muted-foreground font-medium text-base mt-2">
            Sınaq Mərkəzi İdarəetmə Paneli
          </CardDescription>
        </CardHeader>
        <CardContent className="px-10 pb-12">
          <form onSubmit={handleLogin} className="space-y-8">
            <div className="space-y-3">
              <Label htmlFor="pass" className="text-sm font-black text-muted-foreground uppercase tracking-[0.2em] px-1">Təhlükəsizlik Şifrəsi</Label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <ShieldCheck className="h-5 w-5 text-muted-foreground group-focus-within:text-primary transition-colors" />
                </div>
                <Input 
                  id="pass"
                  type="password"
                  placeholder="••••••••"
                  className="h-16 pl-12 bg-muted/20 border-border/50 rounded-2xl text-xl font-bold tracking-[0.3em] focus:ring-primary/20 focus:border-primary transition-all"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                />
              </div>
            </div>
            
            <Button 
              type="submit" 
              className="w-full h-16 bg-primary hover:bg-primary/90 text-white font-black text-xl rounded-2xl shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-1 transition-all duration-300 group"
            >
              Paneli Aç
              <ArrowRight className="ml-2 w-6 h-6 group-hover:translate-x-1 transition-transform" />
            </Button>
          </form>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-muted-foreground/30 text-xs font-black uppercase tracking-[0.5em] z-10">
        Secure Access Restricted
      </p>
    </div>
  );
}