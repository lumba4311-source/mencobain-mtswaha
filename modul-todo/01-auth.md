# Modul 1: Authentication & Authorization

**Status:** ✅ SELESAI (komponen), ❌ BELUM (routing)

---

## Referensi PRD

- **Section 3:** Pengguna Sistem (Roles)
- **Section 5.1:** Alur Login
- **Section 11.1:** Auth Flow

---

## Implementasi

### ✅ Yang Sudah Ada

#### 1. AuthProvider (`features/auth/AuthProvider.tsx`)
- Context provider untuk state auth global
- Fungsi `login(username, password)` dengan validasi
- Fungsi `logout()`
- State management: `user`, `siswa`, `guru` (sesuai role)
- Storage: `sessionStorage` untuk persist session

#### 2. LoginPage (`features/auth/LoginPage.tsx`)
- Form login lengkap dengan validasi
- Theme toggle (dark/light)
- Demo akun untuk testing:
  - Proktor: `proktor` / `proktor123`
  - Guru: `guru1` / `guru123`
  - Siswa: `001` / `siswa123`
- Auto-redirect setelah login sesuai role
- Loading state & error handling

#### 3. Store Functions (`lib/store.ts`)
- `authenticateUser(username, password)` — validasi kredensial
- Return user dengan relasi (siswa/guru) sesuai role

---

### ❌ Yang Belum

#### 1. Page Route (`app/(auth)/login/page.tsx`)
**CRITICAL** — Folder ada tapi kosong, halaman login tidak bisa diakses.

**File yang harus dibuat:**
```typescript
// app/(auth)/login/page.tsx
import LoginPage from '@/features/auth/LoginPage';
export default LoginPage;
```

#### 2. Middleware Route Protection
Belum ada middleware untuk:
- Redirect ke `/login` jika belum login
- Prevent akses halaman role lain (siswa tidak bisa buka `/guru/*`)
- Protect root `/` route

**File yang harus dibuat:**
```typescript
// middleware.ts (root project)
```

#### 3. Layout Auth Group
`app/(auth)/layout.tsx` belum ada — untuk suppress topbar di halaman login.

---

## Testing Checklist

- [ ] `/login` route bisa diakses
- [ ] Login dengan akun siswa redirect ke `/siswa/dashboard`
- [ ] Login dengan akun guru redirect ke `/guru/dashboard`
- [ ] Login dengan akun proktor redirect ke `/proktor/dashboard`
- [ ] Login gagal tampilkan error message
- [ ] Logout clear session dan redirect ke `/login`
- [ ] User belum login tidak bisa akses protected routes
- [ ] Theme toggle berfungsi (dark/light mode)

---

## Prioritas

**HIGH** — Sistem tidak bisa dipakai tanpa route ini.
