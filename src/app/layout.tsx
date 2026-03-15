import type {Metadata} from 'next';
import './globals.css';
import {Toaster} from '@/components/ui/toaster';
import { FirebaseClientProvider } from '@/firebase';

export const metadata: Metadata = {
  title: 'ImtahanFlow - Professional Online Exams',
  description: 'A comprehensive online examination system powered by AI.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="az">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body selection:bg-primary/20">
        <FirebaseClientProvider>
          <main className="min-h-screen">
            {children}
          </main>
          <Toaster />
        </FirebaseClientProvider>
      </body>
    </html>
  );
}
