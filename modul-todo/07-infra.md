# Modul 7: Infrastructure & Shared

**Status:** 🟡 PARTIAL

---

## Referensi PRD

- **Section 13:** Tech Stack
- **Section 14:** Non-Functional Requirements
- **Section 9:** Aturan Bisnis

---

## Yang Sudah Ada

### Store (`lib/store.ts`) — LENGKAP
In-memory state store dengan semua fungsi bisnis logic:
- Seed data (kelas, mapel, users, siswa, guru, ujian, soal, jadwal)
- Auth: `authenticateUser()`
- Exam engine: `joinJadwal()`, `getExamState()`, `saveAnswer()`, `submitSession()`
- Monitoring: `getMonitoringData()`, `forceSubmitSession()`, `autoTimeoutSweep()`
- Histori: `getJadwalAktifBySiswa()`, `getHistoriNilai()`
- Fisher-Yates shuffle: `shuffle()`
- Token generator: `generateToken()`

### Types (`types/`) — perlu dicek
Semua tipe TypeScript untuk entitas sistem.

### Design System (`app/globals.css`) — LENGKAP
CSS variables dan utility classes untuk:
- Dark Forest theme (primary, secondary, surface, dll)
- Topbar, card, badge, btn, table
- Responsive layout

### Components
- `ThemeProvider.tsx` — dark/light mode provider
- `ThemeToggle.tsx` — tombol toggle theme

---

## Yang Belum Ada

### 1. Middleware Route Protection
**File:** `middleware.ts` (root project)

Belum ada middleware Next.js untuk proteksi route secara server-side.
Saat ini setiap halaman melakukan redirect di `useEffect` (client-side) yang menyebabkan flash sebelum redirect.

```typescript
// middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Baca session dari cookie
  // Redirect ke /login jika tidak ada session
  // Redirect ke halaman yang sesuai jika role tidak cocok
}

export const config = {
  matcher: ['/siswa/:path*', '/guru/:path*', '/proktor/:path*'],
};
```

**Catatan:** Karena sistem pakai `sessionStorage` (bukan cookie), middleware server-side tidak bisa baca session. Opsi:
- Pindah ke cookie-based auth (rekomendasi)
- Tetap client-side redirect (acceptable untuk LAN app)

### 2. Error Boundaries
Belum ada error boundary untuk handle runtime error di komponen.

```typescript
// components/ErrorBoundary.tsx
```

### 3. Loading States
Belum ada komponen loading skeleton yang konsisten untuk:
- Tabel data (skeleton rows)
- Card content
- Full page loading

```typescript
// components/LoadingSkeleton.tsx
```

### 4. Toast/Notification System
Saat ini notifikasi masih pakai `alert()` native browser (GuruDashboard baris 114).
Harus diganti dengan toast component yang proper.

```typescript
// components/Toast.tsx
// atau pakai library (react-hot-toast, sonner)
```

### 5. Confirm Dialog
Saat ini konfirmasi hapus masih pakai `confirm()` native browser.
Harus diganti dengan modal dialog yang sesuai design system.

```typescript
// components/ConfirmDialog.tsx
```

### 6. App Layout (`app/layout.tsx`)
Perlu memastikan `AuthProvider` sudah di-wrap di root layout.

### 7. Persistent Storage
Saat ini semua data in-memory — **reset setiap kali server restart**.

Untuk production:
- Pilihan A: Supabase (PostgreSQL) — sesuai skema di PRD
- Pilihan B: SQLite lokal (lebih simpel untuk LAN app)
- Pilihan C: localStorage/IndexedDB (tidak direkomendasikan untuk data ujian)

**Untuk sekarang:** In-memory cukup untuk development/demo.

---

## Shared Components yang Perlu Dibuat

| Komponen | Kegunaan | Prioritas |
|---|---|---|
| `ConfirmDialog` | Ganti `confirm()` native | HIGH |
| `Toast` / `Snackbar` | Ganti `alert()` native | HIGH |
| `LoadingSkeleton` | Loading state tabel/card | MEDIUM |
| `ErrorBoundary` | Handle runtime error | MEDIUM |
| `EmptyState` | Tampilan jika data kosong | LOW |
| `Pagination` | Navigasi tabel banyak data | LOW |

---

## Store Functions yang Belum Ada

Fungsi-fungsi ini dibutuhkan oleh modul yang belum diimplementasi:

```typescript
// Untuk Proktor — Jadwal
createJadwal(data): JadwalUjian
updateJadwal(id, data): void
deleteJadwal(id): void
bukaJadwal(jadwalId, proktorId): void
tutupJadwal(jadwalId): void

// Untuk Proktor — Akun Management
createUser(data): User
updateUser(id, data): void
toggleUserStatus(id): void
resetPassword(id, newPassword): void
createSiswa(data): Siswa
updateSiswa(id, data): void
deleteSiswa(id): void
createGuru(data): Guru
updateGuru(id, data): void
deleteGuru(id): void
updateGuruMapel(idGuru, mapelIds): void

// Untuk Guru — CRUD Ujian
createUjian(data): Ujian
updateUjian(id, data): void
deleteUjian(id): void
```

---

## Testing Checklist

- [ ] `app/layout.tsx` wrap dengan `AuthProvider`
- [ ] `app/page.tsx` redirect sesuai role atau ke `/login`
- [ ] Tidak ada halaman yang pakai `alert()` atau `confirm()` native
- [ ] Semua loading state ada dan tidak ada flash kosong
- [ ] Theme dark/light mode persisten (tidak reset saat reload)

---

## Prioritas

**HIGH** untuk shared components (ConfirmDialog, Toast) karena langsung dipakai oleh modul lain.
**LOW** untuk persistent storage karena in-memory sudah cukup untuk demo.
