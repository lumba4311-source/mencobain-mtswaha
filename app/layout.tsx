import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import { AuthProvider } from '@/features/auth/AuthProvider';
import OfflineIndicator from '@/components/OfflineIndicator';

// Font lokal — tidak butuh internet saat build maupun runtime
const geistSans = localFont({
  src: [
    { path: '../public/fonts/GeistVF.woff2', weight: '100 900', style: 'normal' },
  ],
  variable: '--font-geist-sans',
  display: 'swap',
});

const geistMono = localFont({
  src: [
    { path: '../public/fonts/GeistMonoVF.woff2', weight: '100 900', style: 'normal' },
  ],
  variable: '--font-geist-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'E-CBT MTS WAHA',
  description: 'Evaluasi / Ujian Berbasis Komputer — Madrasah Tsanawiyah WAHA',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            {children}
            <OfflineIndicator />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
