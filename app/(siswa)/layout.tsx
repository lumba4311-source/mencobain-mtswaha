'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAntiCheat } from '@/hooks/useAntiCheat';

export default function SiswaLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Fullscreen + block semua shortcut begitu siswa login — berlaku di semua halaman siswa
  useAntiCheat({
    enableFullscreen: true,
    active: !isLoading && !!user && user.role === 'siswa',
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace('/login');
    else if (user.role !== 'siswa') router.replace('/login');
  }, [user, isLoading, router]);

  if (isLoading || !user || user.role !== 'siswa') return null;
  return <>{children}</>;
}
