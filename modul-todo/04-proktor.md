# Modul 4: Role Proktor

**Status:** ❌ BELUM (0% implementasi)

---

## Referensi PRD

- **Section 3.3:** Proktor (Admin Operasional)
- **Section 5.4:** Alur Proktor Buka Jadwal
- **Section 6.2:** Monitoring Real-Time
- **Section 6.4:** Manajemen Akun Terpusat
- **Section 10.6–10.9:** User Story Proktor
- **Section 12.5:** Wireframe — Proktor Dashboard
- **Section 12.6:** Wireframe — Monitoring Real-Time

---

## Yang Belum Ada (Semua)

### 1. Dashboard Proktor
**File:** `features/proktor/ProktorDashboard.tsx`

**Fitur yang harus ada:**
- Ringkasan sistem:
  - Jumlah siswa aktif
  - Jumlah guru aktif
  - Jumlah ujian tersedia
  - Jumlah jadwal aktif hari ini
- Daftar jadwal hari ini dengan status (Menunggu/Dibuka/Selesai)
- Tombol quick action:
  - Buka jadwal
  - Tutup jadwal
  - Monitoring real-time
- Link ke menu utama:
  - Manajemen jadwal
  - Manajemen akun
  - Laporan/statistik

---

### 2. Manajemen Jadwal Ujian
**File:** `features/proktor/JadwalManagement.tsx`

**Fitur CRUD jadwal:**
- **Create:**
  - Pilih ujian dari daftar ujian tersedia
  - Input ruangan (string)
  - Input kapasitas (default 70)
  - Pilih tanggal & jam mulai
  - Pilih tanggal & jam selesai
  - Generate token 8 karakter (auto)
  - Pilih siswa peserta (multi-select by kelas atau individu)
  - Status awal: "Menunggu"

- **Read:**
  - Tabel jadwal dengan filter by status/tanggal/mapel
  - Detail jadwal: peserta, token, waktu, status

- **Update:**
  - Edit semua field (kecuali token)
  - Tambah/kurangi peserta
  - Hanya bisa edit jika status = "Menunggu"

- **Delete:**
  - Hanya bisa hapus jika belum ada siswa yang join
  - Confirmation dialog

**Store functions yang harus dibuat:**
```typescript
// lib/store.ts
createJadwal(data): JadwalUjian
updateJadwal(id, data): void
deleteJadwal(id): void
getJadwalByStatus(status): JadwalUjian[]
```

---

### 3. Buka/Tutup Jadwal
**File:** Bisa di dalam `JadwalManagement.tsx` atau tombol di dashboard

**Fitur:**
- Tombol "Buka Jadwal" (hanya muncul jika status = "Menunggu")
- Tombol "Tutup Jadwal" (hanya muncul jika status = "Dibuka")
- Validasi:
  - Tidak bisa buka jadwal jika `waktu_mulai` belum sampai
  - Tidak bisa tutup jadwal jika masih ada siswa `status = 'berlangsung'`
- Update `dibuka_oleh` field dengan `id_proktor` saat buka jadwal

**Store functions yang harus dibuat:**
```typescript
// lib/store.ts
bukaJadwal(jadwalId, proktorId): void
tutupJadwal(jadwalId): void
```

---

### 4. Monitoring Real-Time
**File:** `features/proktor/MonitoringPage.tsx`

**Fitur sesuai PRD Section 6.2:**
- Pilih jadwal yang sedang berlangsung (status = "Dibuka")
- Tabel monitoring dengan kolom:
  - Nama siswa
  - Kelas
  - Status (belum masuk / berlangsung / selesai / force-submit)
  - Progres (X/Total soal)
  - Progres % (bar chart)
  - Lama pengerjaan (menit:detik)
  - Sisa waktu (menit:detik)
  - Nilai (jika sudah submit)
  - Tombol "Force Submit"
- Auto-refresh setiap 5 detik
- Auto-timeout sweep (panggil `autoTimeoutSweep()`)
- Filter by status/kelas
- Export CSV

**Store functions yang dipakai:**
```typescript
// lib/store.ts (sudah ada)
getMonitoringData(jadwalId)
forceSubmitSession(sessionId)
autoTimeoutSweep()
```

---

### 5. Manajemen Akun
**File:** `features/proktor/AccountManagement.tsx`

**Fitur sesuai PRD Section 6.4:**
- Tab "Siswa", "Guru", "Proktor"
- CRUD akun per role:
  - **Siswa:** NIS, nama, password, kelas
  - **Guru:** NIP, nama, password, mata pelajaran (relasi `guru_mapel`)
  - **Proktor:** username, nama, password
- Toggle status aktif/nonaktif
- Reset password
- Import massal dari Excel (CSV/XLSX)
- Export daftar akun ke Excel

**Store functions yang harus dibuat:**
```typescript
// lib/store.ts
// User Management
createUser(data): User
updateUser(id, data): void
deleteUser(id): void
toggleUserStatus(id): void
resetPassword(id, newPassword): void

// Siswa Management
createSiswa(data): Siswa
updateSiswa(id, data): void
deleteSiswa(id): void

// Guru Management
createGuru(data): Guru
updateGuru(id, data): void
deleteGuru(id): void
updateGuruMapel(idGuru, mapelIds): void

// Import/Export
importUsersFromCSV(file, role): void
exportUsersToCSV(role): Blob
```

---

### 6. Manajemen Kelas
**File:** `features/proktor/KelasManagement.tsx`

**Fitur:**
- CRUD kelas
- Field: nama_kelas, tingkat, tahun_ajaran
- Lihat daftar siswa per kelas
- Pindah siswa antar kelas

**Store functions yang harus dibuat:**
```typescript
// lib/store.ts
createKelas(data): Kelas
updateKelas(id, data): void
deleteKelas(id): void // hanya jika tidak ada siswa
```

---

### 7. Laporan & Statistik (Optional)
**File:** `features/proktor/LaporanPage.tsx`

**Fitur:**
- Rekap nilai per ujian:
  - Nilai tertinggi, terendah, rata-rata
  - Jumlah lulus/tidak lulus
  - Distribusi nilai (histogram)
- Rekap per kelas:
  - Rata-rata nilai per mapel
  - Ranking siswa
- Rekap per siswa:
  - Histori semua ujian
  - Grafik perkembangan nilai
- Export ke PDF/Excel

---

### 8. Page Routes
**File yang harus dibuat:**
```typescript
// app/(proktor)/dashboard/page.tsx
import ProktorDashboard from '@/features/proktor/ProktorDashboard';
export default ProktorDashboard;

// app/(proktor)/jadwal/page.tsx
import JadwalManagement from '@/features/proktor/JadwalManagement';
export default JadwalManagement;

// app/(proktor)/monitoring/page.tsx
import MonitoringPage from '@/features/proktor/MonitoringPage';
export default MonitoringPage;

// app/(proktor)/akun/page.tsx
import AccountManagement from '@/features/proktor/AccountManagement';
export default AccountManagement;

// app/(proktor)/kelas/page.tsx
import KelasManagement from '@/features/proktor/KelasManagement';
export default KelasManagement;

// app/(proktor)/laporan/page.tsx (optional)
import LaporanPage from '@/features/proktor/LaporanPage';
export default LaporanPage;
```

### 9. Layout Proktor Group
`app/(proktor)/layout.tsx` belum ada — untuk enforce auth proktor only.

---

## Testing Checklist

### Dashboard
- [ ] `/proktor/dashboard` bisa diakses setelah login sebagai proktor
- [ ] Ringkasan sistem tampil dengan data real-time
- [ ] Daftar jadwal hari ini tampil dengan status yang benar
- [ ] Tombol quick action berfungsi

### Manajemen Jadwal
- [ ] Buat jadwal baru dengan validasi lengkap
- [ ] Token 8 karakter auto-generate dan unique
- [ ] Pilih peserta by kelas atau individu
- [ ] Edit jadwal hanya jika status = "Menunggu"
- [ ] Hapus jadwal hanya jika belum ada peserta join
- [ ] Buka jadwal update status jadi "Dibuka" dan set `dibuka_oleh`
- [ ] Tutup jadwal update status jadi "Selesai"
- [ ] Tidak bisa buka jadwal sebelum `waktu_mulai`
- [ ] Tidak bisa tutup jadwal jika ada siswa masih ujian

### Monitoring Real-Time
- [ ] Pilih jadwal yang sedang berlangsung
- [ ] Tabel monitoring tampil dengan data real-time
- [ ] Auto-refresh setiap 5 detik
- [ ] Progres % tampil dengan warna yang tepat (0-100%)
- [ ] Force submit berfungsi dan update status siswa
- [ ] Auto-timeout sweep jalan otomatis
- [ ] Filter by status/kelas berfungsi
- [ ] Export CSV berhasil download file

### Manajemen Akun
- [ ] CRUD siswa berfungsi (buat, edit, hapus)
- [ ] CRUD guru berfungsi + relasi `guru_mapel`
- [ ] CRUD proktor berfungsi
- [ ] Toggle status aktif/nonaktif
- [ ] Reset password berfungsi
- [ ] Import CSV berhasil parse dan insert data
- [ ] Export CSV berhasil download file
- [ ] Validasi: username/NIS/NIP unique

### Manajemen Kelas
- [ ] CRUD kelas berfungsi
- [ ] Tidak bisa hapus kelas jika ada siswa
- [ ] Lihat daftar siswa per kelas
- [ ] Pindah siswa antar kelas

---

## Prioritas

**CRITICAL** — Modul terbesar dan paling kompleks. Tanpa proktor, tidak ada yang bisa buka jadwal ujian.

**Urutan implementasi yang disarankan:**
1. Dashboard (layout & navigation)
2. Manajemen Jadwal (CRUD + buka/tutup)
3. Monitoring Real-Time (fitur inti proktor)
4. Manajemen Akun (CRUD user)
5. Manajemen Kelas
6. Laporan (optional, bisa nanti)
