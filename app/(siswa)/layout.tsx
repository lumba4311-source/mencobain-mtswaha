'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';

export default function SiswaLayout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace('/login');
    else if (user.role !== 'siswa') router.replace('/login');
  }, [user, router]);

  if (!user || user.role !== 'siswa') return null;
  return <>{children}</>;
}
