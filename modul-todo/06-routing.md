# Modul 6: App Routes (page.tsx)

**Status:** ❌ BELUM — Semua folder route kosong

---

## Masalah

Semua folder route di `app/` sudah dibuat tapi isinya kosong (tidak ada `page.tsx`).
Akibatnya sistem **tidak bisa diakses sama sekali** — semua URL return 404.

---

## File yang Harus Dibuat

### Auth

| File | Konten |
|---|---|
| `app/(auth)/login/page.tsx` | `export { default } from '@/features/auth/LoginPage'` |
| `app/(auth)/layout.tsx` | Layout minimal tanpa topbar |

### Siswa

| File | Konten |
|---|---|
| `app/(siswa)/dashboard/page.tsx` | `export { default } from '@/features/siswa/SiswaDashboard'` |
| `app/(siswa)/ujian/page.tsx` | `export { default } from '@/features/siswa/ExamPage'` |
| `app/(siswa)/layout.tsx` | Guard redirect ke `/login` jika bukan role siswa |

### Guru

| File | Konten |
|---|---|
| `app/(guru)/dashboard/page.tsx` | `export { default } from '@/features/guru/GuruDashboard'` |
| `app/(guru)/soal/page.tsx` | `export { default } from '@/features/guru/InputSoalPage'` |
| `app/(guru)/ujian/buat/page.tsx` | `export { default } from '@/features/guru/BuatUjianPage'` (belum ada) |
| `app/(guru)/ujian/edit/page.tsx` | `export { default } from '@/features/guru/EditUjianPage'` (belum ada) |
| `app/(guru)/layout.tsx` | Guard redirect ke `/login` jika bukan role guru |

### Proktor

| File | Konten |
|---|---|
| `app/(proktor)/dashboard/page.tsx` | `export { default } from '@/features/proktor/ProktorDashboard'` (belum ada) |
| `app/(proktor)/jadwal/page.tsx` | `export { default } from '@/features/proktor/JadwalManagement'` (belum ada) |
| `app/(proktor)/monitoring/page.tsx` | `export { default } from '@/features/proktor/MonitoringPage'` (belum ada) |
| `app/(proktor)/akun/page.tsx` | `export { default } from '@/features/proktor/AccountManagement'` (belum ada) |
| `app/(proktor)/kelas/page.tsx` | `export { default } from '@/features/proktor/KelasManagement'` (belum ada) |
| `app/(proktor)/layout.tsx` | Guard redirect ke `/login` jika bukan role proktor |

### Root

| File | Status | Catatan |
|---|---|---|
| `app/page.tsx` | Ada tapi masih boilerplate Next.js | Harus redirect ke `/login` |
| `app/layout.tsx` | Ada | Perlu tambah AuthProvider wrapper |

---

## Pattern Page.tsx

Semua page yang sifatnya hanya wrapper ke feature component bisa dibuat seperti ini:

```typescript
// app/(siswa)/dashboard/page.tsx
import SiswaDashboard from '@/features/siswa/SiswaDashboard';
export default SiswaDashboard;
```

---

## Pattern Layout per Role Group

```typescript
// app/(siswa)/layout.tsx
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
```

---

## Root Page

```typescript
// app/page.tsx
'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/features/auth/AuthProvider';

export default function RootPage() {
  const { user } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!user) router.replace('/login');
    else if (user.role === 'siswa') router.replace('/siswa/dashboard');
    else if (user.role === 'guru') router.replace('/guru/dashboard');
    else if (user.role === 'proktor') router.replace('/proktor/dashboard');
  }, [user, router]);
  return null;
}
```

---

## Prioritas

**CRITICAL** — Harus dikerjakan pertama sebelum fitur lain karena tanpa ini sistem 404 semua.
