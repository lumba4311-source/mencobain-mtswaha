# Modul 3: Role Guru

**Status:** 🟡 PARTIAL

---

## Referensi PRD

- **Section 3.2:** Guru (Pembuat Soal)
- **Section 5.3:** Alur Guru Buat Ujian
- **Section 6.3:** Manajemen Bank Soal
- **Section 10.4–10.5:** User Story Guru
- **Section 12.3:** Wireframe — Guru Dashboard
- **Section 12.4:** Wireframe — Input Soal

---

## Implementasi

### ✅ Yang Sudah Ada

#### 1. Dashboard Guru (`features/guru/GuruDashboard.tsx`)
**PARTIAL** — Dashboard ada tapi fitur CRUD ujian belum lengkap:
- Profil guru (nama, NIP, mata pelajaran)
- Daftar ujian milik guru (filter by `id_guru`)
- Jumlah soal per ujian
- Tombol "Kelola Soal" (link ke halaman input soal)
- **Tombol "Edit" masih stub** (`alert('Edit ujian')`)
- **Belum ada tombol "Buat Ujian Baru"**
- **Belum ada tombol "Hapus Ujian"**

#### 2. Halaman Input Soal (`features/guru/InputSoalPage.tsx`)
**LENGKAP** — Full CRUD soal sesuai PRD:
- Tab "Tambah Soal" — form input soal per soal
- Tab "Edit Massal" — edit banyak soal sekaligus (spreadsheet style)
- Validasi: pertanyaan & semua opsi A-E wajib diisi
- Edit soal yang sudah ada
- Hapus soal dengan konfirmasi
- Bobot per soal (default 1, bisa diubah)
- Jawaban benar pilih dari dropdown (A/B/C/D/E)
- Reorder soal (urutan nomor)
- Preview soal
- Auto-save setiap perubahan

**Store functions yang dipakai:**
- Store langsung mutate `store.soals` (in-memory)

---

### ❌ Yang Belum

#### 1. Form Buat Ujian Baru
Belum ada komponen untuk:
- Input nama ujian
- Pilih mata pelajaran (dari `guru_mapel` relasi)
- Pilih jenis ujian (UMBK/UAS/PAS/PTS/TRYOUT/LATIHAN)
- Set durasi (menit)
- Set KKM (default 75)
- Toggle acak soal / acak opsi
- Toggle tampil hasil ke siswa
- Pilih kelas target (multi-select, relasi `ujian_kelas`)

**File yang harus dibuat:**
```typescript
// features/guru/BuatUjianPage.tsx
```

#### 2. Form Edit Ujian
Edit metadata ujian (nama, durasi, KKM, kelas target, dll).

**File yang harus dibuat:**
```typescript
// features/guru/EditUjianPage.tsx
```

#### 3. Hapus Ujian
Confirmation dialog + cascade delete soal & relasi.

**Bisa di dashboard atau di form edit.**

#### 4. Page Routes
**CRITICAL** — Folder ada tapi kosong.

**File yang harus dibuat:**
```typescript
// app/(guru)/dashboard/page.tsx
import GuruDashboard from '@/features/guru/GuruDashboard';
export default GuruDashboard;

// app/(guru)/soal/page.tsx
import InputSoalPage from '@/features/guru/InputSoalPage';
export default InputSoalPage;

// app/(guru)/ujian/buat/page.tsx (new)
import BuatUjianPage from '@/features/guru/BuatUjianPage';
export default BuatUjianPage;

// app/(guru)/ujian/edit/page.tsx (new)
import EditUjianPage from '@/features/guru/EditUjianPage';
export default EditUjianPage;
```

#### 5. Layout Guru Group
`app/(guru)/layout.tsx` belum ada — untuk enforce auth guru only.

#### 6. Store Functions
Belum ada fungsi untuk:
- `createUjian(data)` — buat ujian baru + relasi `ujian_kelas`
- `updateUjian(id, data)` — update metadata ujian
- `deleteUjian(id)` — hapus ujian + cascade soal

**File:** `lib/store.ts`

---

## Testing Checklist

### Dashboard
- [ ] `/guru/dashboard` bisa diakses setelah login sebagai guru
- [ ] Profil guru tampil dengan NIP & mapel yang benar
- [ ] Daftar ujian hanya tampilkan ujian milik guru tersebut (`id_guru`)
- [ ] Tombol "Buat Ujian Baru" redirect ke form
- [ ] Tombol "Kelola Soal" berfungsi (link ke halaman input soal)
- [ ] Tombol "Edit" redirect ke form edit ujian
- [ ] Tombol "Hapus" tampilkan konfirmasi dan cascade delete

### Form Buat Ujian
- [ ] Pilih mata pelajaran hanya tampilkan mapel yang diampu guru (`guru_mapel`)
- [ ] Semua field wajib divalidasi
- [ ] KKM default 75
- [ ] Acak soal & acak opsi default `true`
- [ ] Tampil hasil default `false`
- [ ] Bisa pilih multiple kelas
- [ ] Setelah submit, redirect ke halaman kelola soal

### Form Edit Ujian
- [ ] Load data ujian yang ada
- [ ] Update metadata ujian
- [ ] Update kelas target (relasi `ujian_kelas`)
- [ ] Tidak bisa ubah `id_guru` (ownership)

### Halaman Input Soal
- [ ] Tab "Tambah Soal" bisa tambah soal baru
- [ ] Tab "Edit Massal" tampilkan semua soal dalam grid
- [ ] Edit soal existing update data di store
- [ ] Hapus soal dengan konfirmasi
- [ ] Validasi: pertanyaan & opsi A-E wajib diisi
- [ ] Bobot soal bisa diubah
- [ ] Preview soal tampilkan format akhir

---

## Prioritas

**MEDIUM-HIGH** — Guru perlu bisa buat ujian baru, sekarang hanya bisa edit soal dari ujian yang sudah ada (seed data).
