
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Lock, ShieldCheck } from 'lucide-react';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const router = useRouter();
  const { toast } = useToast();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === 'Nicat_2010') {
      sessionStorage.setItem('admin_auth', 'true');
      router.push('/nicat/admin/dashboard');
    } else {
      toast({ title: 'Xəta', description: 'Yanlış şifrə!', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-none bg-slate-800 text-white shadow-2xl">
        <CardHeader className="text-center">
          <div className="mx-auto bg-primary/20 p-3 rounded-full w-fit mb-4">
            <Lock className="w-8 h-8 text-primary" />
          </div>
          <CardTitle className="text-2xl font-bold">Admin Girişi</CardTitle>
          <p className="text-slate-400 text-sm">Yalnız səlahiyyətli şəxslər daxil ola bilər</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="pass" className="text-slate-300">İdarəetmə Şifrəsi</Label>
              <Input 
                id="pass"
                type="password"
                className="bg-slate-700 border-slate-600 text-white focus:ring-primary"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90">
              <ShieldCheck className="w-4 h-4 mr-2" />
              Sistemi Aç
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
