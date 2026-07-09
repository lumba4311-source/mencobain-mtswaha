# Modul 5: Role Admin

**Status:** ❌ BELUM (0% implementasi)

---

## Referensi PRD

- **Section 3.4:** Admin (Role Sistem)

---

## Catatan

Role Admin di PRD disebutkan sebagai "role sistem dengan akses tertinggi untuk konfigurasi tingkat infrastruktur", tapi tidak ada detail spesifik fitur apa yang harus dimiliki.

---

## Asumsi Fitur (belum ada di PRD)

Berdasarkan konteks sistem UMBK, role Admin kemungkinan punya akses ke:

### 1. System Settings
- Konfigurasi global (nama sekolah, logo, tahun ajaran aktif)
- Konfigurasi default (KKM default, max capacity default, durasi default)
- Maintenance mode toggle

### 2. Backup & Restore
- Export semua data ke JSON/SQL
- Import data dari backup
- Reset database (dangerous)

### 3. Audit Log
- Histori semua aktivitas user (login, buat ujian, buka jadwal, dll)
- Filter by user/role/action/timestamp

### 4. User Management (Superuser)
- Akses penuh ke semua user (termasuk proktor)
- Buat/edit/hapus proktor (proktor tidak bisa manage proktor lain)
- Reset password semua user

---

## Rekomendasi

**Konsultasikan dengan user/client:**
- Apakah role Admin benar-benar dibutuhkan?
- Fitur apa yang harus dimiliki Admin yang tidak dimiliki Proktor?
- Apakah Proktor sudah cukup sebagai "admin" sistem?

**Jika tidak ada requirement jelas, bisa skip dulu** dan fokus ke role Proktor (yang sudah jelas fiturnya di PRD).

---

## Prioritas

**LOW** — Tidak ada spesifikasi jelas di PRD, bisa dikerjakan paling akhir atau bahkan di-skip.
