'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';

export default function RootPage() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!user) router.replace('/login');
    else if (user.role === 'siswa')   router.replace('/siswa/dashboard');
    else if (user.role === 'guru')    router.replace('/guru/dashboard');
    else if (user.role === 'proktor') router.replace('/proktor/dashboard');
    else if (user.role === 'admin')   router.replace('/proktor/dashboard');
    else router.replace('/login');
  }, [user, router]);

  return null;
}
