'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';

export default function GuruLayout({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user || user.role !== 'guru') router.replace('/login');
  }, [user, isLoading, router]);

  if (isLoading) return null;
  if (!user || user.role !== 'guru') return null;
  return <>{children}</>;
}
