# Modul 2: Role Siswa

**Status:** ✅ SELESAI (komponen), ❌ BELUM (routing)

---

## Referensi PRD

- **Section 3.1:** Siswa (Peserta Ujian)
- **Section 5.2:** Alur Siswa Ikut Ujian
- **Section 6.1:** Resume Session
- **Section 10.1–10.3:** User Story Siswa
- **Section 12.1:** Wireframe — Siswa Dashboard
- **Section 12.2:** Wireframe — Halaman Ujian

---

## Implementasi

### ✅ Yang Sudah Ada

#### 1. Dashboard Siswa (`features/siswa/SiswaDashboard.tsx`)
**LENGKAP** — Semua fitur sesuai PRD:
- Profil singkat (nama, NIS, kelas)
- Daftar ujian tersedia (jadwal aktif)
- Tombol "Mulai Ujian" (hanya muncul jika status = "Dibuka")
- Riwayat ujian (histori nilai lengkap dengan detail benar/salah/kosong)
- Indikator lulus/tidak lulus berdasarkan KKM
- Theme toggle & logout

**Store functions yang dipakai:**
- `getJadwalAktifBySiswa(siswaId)` — ambil jadwal yang relevan untuk siswa
- `getHistoriNilai(siswaId)` — ambil semua nilai ujian yang sudah dikerjakan

#### 2. Halaman Ujian (`features/siswa/ExamPage.tsx`)
**LENGKAP** — Full exam engine sesuai PRD:
- Input token untuk join jadwal
- Timer countdown real-time (detik per detik)
- Auto-save jawaban setiap pilih opsi (debounce 500ms)
- Navigasi soal dengan status visual (belum dijawab, sudah dijawab, ragu-ragu)
- Tombol tandai "Ragu-ragu" untuk review nanti
- Submit dengan konfirmasi
- Auto-submit jika waktu habis
- Resume session — siswa bisa keluar dan masuk lagi tanpa kehilangan progres
- Soal & opsi diacak per siswa (Fisher-Yates shuffle)

**Store functions yang dipakai:**
- `joinJadwal(jadwalId, siswaId, token)` — validasi token & create session
- `getExamState(sessionId)` — load state lengkap (soal, jawaban, sisa waktu)
- `saveAnswer(...)` — UPSERT jawaban per soal
- `submitSession(sessionId)` — finalisasi & hitung nilai
- `autoTimeoutSweep()` — auto-submit jika deadline lewat

---

### ❌ Yang Belum

#### 1. Page Routes
**CRITICAL** — Folder ada tapi kosong, halaman tidak bisa diakses.

**File yang harus dibuat:**
```typescript
// app/(siswa)/dashboard/page.tsx
import SiswaDashboard from '@/features/siswa/SiswaDashboard';
export default SiswaDashboard;

// app/(siswa)/ujian/page.tsx
import ExamPage from '@/features/siswa/ExamPage';
export default ExamPage;
```

#### 2. Layout Siswa Group
`app/(siswa)/layout.tsx` belum ada — untuk enforce auth siswa only.

---

## Testing Checklist

### Dashboard
- [ ] `/siswa/dashboard` bisa diakses setelah login sebagai siswa
- [ ] Profil singkat tampil dengan NIS & kelas yang benar
- [ ] Daftar ujian aktif tampil jika ada jadwal status "Dibuka"
- [ ] Tombol "Mulai Ujian" hanya muncul untuk jadwal yang sudah dibuka
- [ ] Histori nilai tampil dengan data benar/salah/kosong/nilai/status lulus
- [ ] Logout berfungsi dan redirect ke `/login`

### Halaman Ujian
- [ ] Input token validasi benar (token salah tampilkan error)
- [ ] Setelah join, soal & opsi tampil dengan urutan berbeda per siswa
- [ ] Timer countdown berjalan real-time (update tiap detik)
- [ ] Pilih opsi auto-save (cek jawaban tersimpan di store)
- [ ] Tombol "Ragu-ragu" ubah status soal jadi kuning
- [ ] Navigasi soal tampilkan status visual yang tepat (abu/hijau/kuning)
- [ ] Submit ujian tampilkan konfirmasi
- [ ] Auto-submit jika waktu habis
- [ ] Resume: keluar halaman dan masuk lagi, state tetap (jawaban + sisa waktu)
- [ ] Tidak bisa join jadwal yang sama 2 kali (unique constraint)

---

## Prioritas

**HIGH** — Modul inti sistem, siswa adalah user utama.
