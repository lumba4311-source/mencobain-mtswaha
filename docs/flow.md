# Dokumentasi Fitur & Flow Aplikasi
# ECBT MTS Waha — v2.1.0

> Stack: Next.js · Supabase (PostgreSQL + Auth + Storage) · TypeScript  
> Dibuat: 15 Juli 2026

---

## Daftar Isi

1. [Gambaran Umum](#1-gambaran-umum)
2. [Role & Hak Akses](#2-role--hak-akses)
3. [Arsitektur Autentikasi](#3-arsitektur-autentikasi)
4. [Flow: Autentikasi](#4-flow-autentikasi)
5. [Flow: Guru](#5-flow-guru)
6. [Flow: Proktor / Admin](#6-flow-proktor--admin)
7. [Flow: Siswa](#7-flow-siswa)
8. [Flow: Sesi Ujian (Detail)](#8-flow-sesi-ujian-detail)
9. [API Endpoints](#9-api-endpoints)
10. [Middleware & Route Protection](#10-middleware--route-protection)

---

## 1. Gambaran Umum

ECBT (Electronic Computer Based Test) MTS Waha adalah sistem ujian berbasis komputer (CBT) yang memungkinkan guru membuat ujian, proktor menjadwalkan dan memantau, serta siswa mengerjakan ujian secara online dengan fitur pengacakan soal dan opsi.

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Guru     │     │   Proktor   │     │    Siswa    │
│             │     │   / Admin   │     │             │
│ Buat ujian  │     │ Kelola akun │     │ Kerjakan    │
│ Input soal  │     │ Jadwalkan   │     │ ujian       │
│ Edit ujian  │     │ Monitor     │     │ Lihat hasil │
│             │     │ Hasil/nilai │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
        │                  │                   │
        └──────────────────┴───────────────────┘
                           │
                    ┌──────▼──────┐
                    │  Supabase   │
                    │ PostgreSQL  │
                    │    Auth     │
                    │   Storage   │
                    └─────────────┘
```

---

## 2. Role & Hak Akses

| Role | Dashboard | Hak Akses |
|---|---|---|
| `siswa` | `/siswa/dashboard` | Melihat jadwal, mengerjakan ujian, melihat hasil (jika diizinkan guru) |
| `guru` | `/guru/dashboard` | Membuat/edit/hapus ujian, mengelola soal, upload gambar soal |
| `proktor` | `/proktor/dashboard` | Semua akses: kelola akun, jadwal, monitoring, hasil |
| `admin` | `/proktor/dashboard` | Alias dari `proktor` — akses identik |

---

## 3. Arsitektur Autentikasi

```
Browser                     Next.js Server              Supabase
   │                              │                          │
   │  POST /api/auth/login        │                          │
   │─────────────────────────────>│                          │
   │                              │  signInWithPassword()    │
   │                              │─────────────────────────>│
   │                              │<─────────────────────────│
   │                              │  Set HttpOnly cookies:   │
   │<─────────────────────────────│  umbk-access-token (1h)  │
   │  { ok, role, user, tokens }  │  umbk-refresh-token (30d)│
   │                              │                          │
   │  supabase.auth.setSession()  │                          │
   │  (localStorage tokens)       │                          │
```

**Dua lapisan token:**
- **HttpOnly cookies** — digunakan oleh middleware Edge untuk validasi per-request
- **localStorage** (Supabase SDK) — digunakan oleh client-side untuk Supabase Storage dan realtime

**Auto-refresh:**
- Middleware mencoba refresh token jika access token kedaluwarsa
- `AuthProvider` mendengarkan event `TOKEN_REFRESHED` dari Supabase SDK

---

## 4. Flow: Autentikasi

### 4.1 Login

```
Pengguna buka /login
        │
        ▼
Isi username + password → Submit
        │
        ▼
POST /api/auth/login
        │
   ┌────┴────┐
   │ Berhasil│          Gagal
   └────┬────┘            │
        │            Tampilkan pesan error inline
        ▼
Server set cookies (HttpOnly)
        │
        ▼
Client setSession() ke Supabase SDK
        │
        ▼
Redirect berdasarkan role:
  siswa   → /siswa/dashboard
  guru    → /guru/dashboard
  proktor → /proktor/dashboard
```

### 4.2 Session Restore (tiap halaman dimuat)

```
AuthProvider.restoreSession()
        │
        ▼
supabase.auth.getSession() dari localStorage
        │
   ┌────┴──────────┐
   │ Token ada     │  Token tidak ada
   └────┬──────────┘        │
        │              GET /api/auth/me (cookie-only)
        ▼                    │
GET /api/auth/me        ┌────┴────┐
  dengan Bearer token   │ Berhasil│  Gagal → clear state
        │               └────┬────┘
   ┌────┴────┐               ▼
   │   401   │  OK    Set user context
   └────┬────┘
        ▼
Fallback: GET /api/auth/me
  cookie-only (server refresh)
```

### 4.3 Offline Handling

Jika `navigator.onLine === false` saat restore session, state dipertahankan (`isOffline = true`) dan tidak ada logout paksa. Session dipulihkan otomatis saat koneksi kembali via event `window.online`.

### 4.4 Logout

```
Klik "Logout"
      │
      ▼
POST /api/auth/logout → Hapus cookies di server
      │
      ▼
supabase.auth.signOut() → Hapus localStorage
      │
      ▼
Clear state (user, siswa, guru = null)
      │
      ▼
Redirect ke /login
```

---

## 5. Flow: Guru

### 5.1 Dashboard Guru (`/guru/dashboard`)

Menampilkan seluruh ujian milik guru yang sedang login beserta jumlah soal per ujian.

**Aksi tersedia:**
- Buat Ujian baru → `/guru/buat`
- Input Soal → `/guru/soal?ujian={id}`
- Edit Ujian → `/guru/edit?ujian={id}`
- Hapus Ujian (dengan konfirmasi)

### 5.2 Buat Ujian Baru

```
Klik "Buat Ujian"
      │
      ▼
/guru/buat — Isi nama ujian
      │
      ▼
POST /api/ujian
  { nama_ujian, jenis_ujian: 'LATIHAN', durasi: 90,
    acak_soal: true, acak_opsi: true, tampil_hasil: false }
      │
      ▼
Redirect ke /guru/soal?ujian={id baru}
```

> Default jenis ujian adalah `LATIHAN`. Ubah di halaman Edit.

### 5.3 Input / Edit Soal (`/guru/soal?ujian={id}`)

```
Halaman dimuat
      │
      ├── GET /api/ujian/{id}  (info ujian)
      └── GET /api/soal/{id}   (daftar soal)
      │
      ▼
Form tersedia untuk tambah soal baru

[Tambah Soal]
      │
      ▼
Isi: pertanyaan, opsi A-D, jawaban benar
Opsional: upload gambar (max 10MB, image/*)
      │
      ▼ (jika ada gambar)
Upload ke Supabase Storage → dapat public URL
      │
      ▼
POST /api/soal
      │
      ▼
Soal muncul di daftar, form direset

[Edit Soal]
      │
      ▼
Klik "Edit" pada baris soal → form terisi
Ubah field yang diinginkan
PATCH /api/soal/{id}

[Hapus Soal]
      │
      ▼
Klik "Hapus" → konfirmasi modal
DELETE /api/soal/{id}
```

**Edit nama ujian inline:** Nama ujian di topbar bisa langsung diedit dan disimpan via `PATCH /api/ujian/{id}`.

### 5.4 Edit Ujian (`/guru/edit?ujian={id}`)

```
Halaman dimuat
      │
      ├── GET /api/ujian/{id}
      └── GET /api/akun (daftar kelas)
      │
      ▼
Cek kepemilikan: ujian.id_guru === guru.id
Jika tidak → redirect ke dashboard
      │
      ▼
Form terisi dengan data saat ini

Field yang bisa diubah:
  - Nama ujian
  - Jenis ujian (UMBK / UAS / PAS / PTS / TRYOUT / LATIHAN)
  - Durasi (menit)
  - Acak soal (toggle)
  - Acak opsi (toggle)
  - Tampil hasil ke siswa (toggle)
  - Kelas yang ditugaskan (toggle per kelas)
      │
      ▼
PATCH /api/ujian/{id}
      │
      ▼
Redirect ke /guru/dashboard
```

---

## 6. Flow: Proktor / Admin

### 6.1 Dashboard Proktor (`/proktor/dashboard`)

Menampilkan ringkasan:
- Total siswa, guru, dan ujian
- Daftar semua jadwal ujian dengan badge Published/Draft
- Tombol "Detail" per jadwal → monitoring

### 6.2 Manajemen Akun (`/proktor/akun`)

#### Tambah Akun Manual

```
Pilih tab Siswa atau Guru
Klik "Tambah"
      │
      ▼
Isi form:
  Siswa: nama, NIS, kelas, username, password
  Guru:  nama, NIP, username, password
      │
      ▼
POST /api/akun
  (membuat auth.users + profiles + siswas/gurus)
```

#### Import Massal Siswa (dari Excel)

```
Klik "Import"
      │
      ▼
Buka Excel → Salin data (tab-delimited)
Tempel ke textarea
      │
      ▼
Format kolom: nama | kelas | username | password
      │
      ▼
Klik "Proses Import"
POST /api/akun/import
      │
      ▼
Tampilkan hasil:
  ✓ {n} akun berhasil dibuat
  ✗ Baris {n}: {pesan error} (per baris)
```

#### Reset Password

```
Klik "Reset Password" pada baris akun
      │
      ▼
Modal — isi password baru
PATCH /api/akun/{id}/password
```

#### Hapus Akun

```
Klik "Hapus" → konfirmasi
DELETE /api/akun/{id}
(menghapus auth.users, profiles, dan data terkait)
```

### 6.3 Manajemen Jadwal Ujian (`/proktor/jadwal`)

#### Buat Jadwal

```
Klik "Buat Jadwal"
      │
      ▼
Pilih ujian dari dropdown
Atur kapasitas maksimal (default: 70)
Atur durasi menit (default: 90)
      │
      ▼
Pilih siswa peserta:
  - Filter by kelas
  - Cari nama siswa
  - Toggle individual / pilih semua per kelas
      │
      ▼
POST /api/jadwal
  { id_ujian, max_capacity, durasi_menit, siswa_ids[] }
      │
      ▼
Jadwal berstatus "Draft" — siswa belum bisa mengakses
```

#### Publish / Unpublish Jadwal

```
Klik "..." pada baris jadwal → Publish
      │
      ▼
Konfirmasi dialog
PATCH /api/jadwal/{id} { status_publikasi: 'Published' }
      │
      ▼
Siswa yang terdaftar kini bisa melihat dan memulai ujian
```

#### Edit / Hapus Jadwal

```
"..." menu → Edit   → form pre-filled → PATCH /api/jadwal/{id}
"..." menu → Hapus  → konfirmasi       → DELETE /api/jadwal/{id}
```

### 6.4 Monitoring Real-time (`/proktor/monitoring`)

```
Pilih jadwal dari dropdown (atau URL param ?jadwal=)
      │
      ▼
GET /api/monitoring?jadwalId={id}
      │
      ▼
Tabel per siswa:
  Nama | Kelas | Status | Progress | Sisa Waktu

Status:
  "Belum Ujian"   — belum memulai
  "Berlangsung"   — sedang mengerjakan
  "Selesai"       — sudah submit

Sisa waktu dihitung client-side: deadline - now()
  (update tiap detik via setInterval)
```

#### Force Submit

```
Klik "Force Submit" pada siswa yang "Berlangsung"
      │
      ▼
Konfirmasi: "Submit jawaban {nama}? Jawaban yang sudah
             diisi akan dikumpulkan."
      │
      ▼
POST /api/nilai { sessionId, forceSubmit: true }
      │
      ▼
Server: hitung nilai, simpan ke tabel `nilai`,
        update session.status = 'force_submit'
      │
      ▼
Monitoring: baris berubah ke "Selesai"
Siswa: polling 20 detik mendeteksi 'force_submit'
       → notifikasi full-screen → redirect ke dashboard
```

### 6.5 Hasil Ujian (`/proktor/hasil`)

```
Pilih jadwal dari dropdown
      │
      ▼
GET /api/nilai?jadwalId={id}
      │
      ▼
Tabel: Kelas | Nama | Nilai | Benar | Salah | Status Lulus
  Nilai hijau = lulus, merah = tidak lulus

Sortir: by kelas / nama / nilai (client-side)

Klik "Export Excel"
      │
      ▼
Generate .xlsx client-side via library `xlsx`
Download otomatis ke browser
```

---

## 7. Flow: Siswa

### 7.1 Dashboard Siswa (`/siswa/dashboard`)

```
Halaman dimuat
      │
      ├── GET /api/jadwal?siswaId={id}  (jadwal yang diikuti)
      ├── GET /api/ujian                (info ujian)
      └── GET /api/akun                (info kelas)
      │
      ▼
Untuk tiap jadwal:
  GET /api/session?siswaId={id}&jadwalId={id}
  (paralel via Promise.all)
      │
      ▼
Tampilkan daftar ujian dengan tombol sesuai status:
```

| Kondisi | Tombol |
|---|---|
| Jadwal `Draft` | "Belum Dibuka" (disabled) |
| Jadwal `Published`, belum ada session | "Mulai Ujian" |
| Session `berlangsung` | "Lanjutkan Ujian" |
| Session `selesai` atau `force_submit` | "Selesai" (disabled) |

### 7.2 Mulai / Lanjutkan Ujian

```
Klik "Mulai Ujian" atau "Lanjutkan Ujian"
      │
      ▼
Navigasi ke /siswa/ujian?jadwal={id}
```

---

## 8. Flow: Sesi Ujian (Detail)

### 8.1 Fase Konfirmasi

```
/siswa/ujian?jadwal={id}
      │
      ▼
GET /api/jadwal/{id}  → info ujian, durasi
GET /api/session?siswaId&jadwalId → cek sesi existing
      │
      ▼
Tampilkan layar konfirmasi:
  - Nama ujian
  - Jenis ujian
  - Jumlah soal
  - Durasi
  - Tombol "Mulai Ujian"
```

### 8.2 Mulai Sesi Baru

```
Klik "Mulai Ujian"
      │
      ▼
POST /api/session
  { id_jadwal, id_siswa }
      │
      ▼
Server:
  1. Ambil semua soal ujian
  2. Fisher-Yates shuffle urutan soal (jika acak_soal = true)
  3. Fisher-Yates shuffle urutan opsi tiap soal (jika acak_opsi = true)
  4. Simpan urutan_soal (JSONB) dan urutan_opsi (JSONB) ke session
  5. Hitung deadline = now() + durasi_menit
  6. Buat record jawaban kosong untuk tiap soal (status: 'belum')
  7. Return session object
      │
      ▼
Client: masuk ke fase 'exam'
```

### 8.3 Resume Sesi yang Ada

```
Jika session existing ditemukan (status: 'berlangsung'):
      │
      ▼
GET /api/soal/{ujianId}     → daftar soal
GET /api/jawaban?sessionId  → jawaban yang sudah diisi
      │
      ▼
Hitung sisa waktu: deadline - now()
Lanjutkan dari soal terakhir yang dikerjakan
```

### 8.4 Pengerjaan Ujian (Fase Exam)

```
Tampilkan soal ke-{currentIndex}:
  - Nomor soal / total (misal: 5 / 40)
  - Gambar (jika ada)
  - Pertanyaan
  - Opsi pilihan (urutan sesuai urutan_opsi session)
  - Panel navigasi soal (semua nomor)
      │
      ▼
Siswa klik salah satu opsi
      │
      ▼
PATCH /api/jawaban/{id}
  { jawaban_siswa: 'A'|'B'|'C'|'D', status_soal: 'sudah' }
      │
      ▼
jawaban diupdate di state lokal (optimistic)

Siswa bisa tandai soal "Ragu":
PATCH /api/jawaban/{id} { status_soal: 'ragu' }

Navigasi antar soal:
  - Tombol Prev / Next
  - Klik nomor di panel navigasi
```

**Warna panel navigasi:**
| Warna | Status |
|---|---|
| Abu-abu | `belum` — belum dijawab |
| Hijau | `sudah` — sudah dijawab |
| Kuning | `ragu` — dijawab tapi ragu |
| Biru | Soal yang sedang dilihat |

### 8.5 Timer & Auto-submit

```
setInterval 1 detik:
  timeLeft = timeLeft - 1
  Jika timeLeft <= 0:
    Tampilkan overlay "Waktu Habis!"
    Tunggu 3 detik
    Trigger submit otomatis
```

```
setInterval 30 detik (re-sync):
  GET /api/session?siswaId&jadwalId
  Recalculate timeLeft dari deadline server
  (mencegah drift jika tab di-background)
```

### 8.6 Submit Manual

```
Klik "Selesai"
      │
      ▼
Jika ada soal belum dijawab:
  Tampilkan banner peringatan + highlight soal kosong
  Siswa bisa tetap submit atau kembali mengerjakan
      │
      ▼
Modal konfirmasi:
  "Kamu yakin ingin mengumpulkan jawaban?
   {n} soal belum dijawab."
      │
      ▼
POST /api/nilai { sessionId }
      │
      ▼
Server:
  1. Hitung jumlah_benar, jumlah_salah, jumlah_kosong
  2. Hitung nilai = (jumlah_benar / total_soal) * 100 * bobot
  3. Tentukan lulus = nilai >= ujian.nilai_kkm
  4. Simpan ke tabel `nilai`
  5. Update session.status = 'selesai'
      │
      ▼
Tampilkan overlay hasil (jika tampil_hasil = true):
  Nilai, Jumlah Benar, Lulus/Tidak
      │
      ▼
Redirect ke /siswa/dashboard
```

### 8.7 Force Submit oleh Proktor

```
Proktor POST /api/nilai { sessionId, forceSubmit: true }
      │
      ▼
Server update session.status = 'force_submit'
      │
      ▼
Client siswa — polling 20 detik:
GET /api/session?siswaId&jadwalId
      │
      ▼
Deteksi status === 'force_submit'
      │
      ▼
Tampilkan overlay notifikasi:
  "Ujian dihentikan oleh proktor"
Tunggu 5 detik
Redirect ke /siswa/dashboard
```

---

## 9. API Endpoints

### Auth
| Method | Path | Deskripsi |
|---|---|---|
| `POST` | `/api/auth/login` | Login, set cookies |
| `POST` | `/api/auth/logout` | Logout, hapus cookies |
| `GET` | `/api/auth/me` | Validasi session, return user+role |

### Akun
| Method | Path | Deskripsi |
|---|---|---|
| `GET` | `/api/akun` | List semua siswa, guru, kelas |
| `POST` | `/api/akun` | Buat akun baru (siswa/guru) |
| `PATCH` | `/api/akun/{id}` | Update data akun |
| `DELETE` | `/api/akun/{id}` | Hapus akun |
| `PATCH` | `/api/akun/{id}/password` | Reset password |
| `POST` | `/api/akun/import` | Bulk import akun dari data tabel |

### Ujian
| Method | Path | Deskripsi |
|---|---|---|
| `GET` | `/api/ujian` | List ujian (filter by guruId) |
| `GET` | `/api/ujian/{id}` | Detail satu ujian |
| `POST` | `/api/ujian` | Buat ujian baru |
| `PATCH` | `/api/ujian/{id}` | Update ujian |
| `DELETE` | `/api/ujian/{id}` | Hapus ujian + semua soal |

### Soal
| Method | Path | Deskripsi |
|---|---|---|
| `GET` | `/api/soal/{ujianId}` | List soal per ujian |
| `POST` | `/api/soal` | Tambah soal |
| `PATCH` | `/api/soal/{id}` | Edit soal |
| `DELETE` | `/api/soal/{id}` | Hapus soal |

### Jadwal
| Method | Path | Deskripsi |
|---|---|---|
| `GET` | `/api/jadwal` | List semua jadwal |
| `GET` | `/api/jadwal/{id}` | Detail satu jadwal |
| `POST` | `/api/jadwal` | Buat jadwal baru + assign siswa |
| `PATCH` | `/api/jadwal/{id}` | Edit jadwal / publish / unpublish |
| `DELETE` | `/api/jadwal/{id}` | Hapus jadwal |

### Session & Exam
| Method | Path | Deskripsi |
|---|---|---|
| `GET` | `/api/session` | Cek/ambil session (by siswaId+jadwalId) |
| `POST` | `/api/session` | Buat session baru + shuffle soal |
| `GET` | `/api/jawaban` | List jawaban per session |
| `PATCH` | `/api/jawaban/{id}` | Update jawaban siswa |
| `POST` | `/api/nilai` | Submit ujian (hitung & simpan nilai) |
| `GET` | `/api/nilai` | List nilai (filter by jadwalId) |
| `GET` | `/api/monitoring` | Data monitoring per jadwal |

---

## 10. Middleware & Route Protection

File: `middleware.ts` — berjalan di Edge Runtime pada setiap request.

```
Request masuk
      │
      ▼
Route public? (bukan /proktor /siswa /guru /admin /login)
      │ Ya → pass through
      │
      ▼
Baca cookie umbk-access-token
Validasi via Supabase service-role getUser()
      │
      ├─ Valid → lanjut ke cek role
      │
      └─ Invalid → coba refresh via umbk-refresh-token
                        │
                   ┌────┴────┐
                   │ Berhasil│  Gagal
                   └────┬────┘    │
                        │    Protected route? → redirect /login
                        │    /login route?    → pass through
                        ▼
               Query profiles untuk role
                        │
                        ▼
              Role enforcement:
                /proktor, /admin → butuh role 'proktor'/'admin'
                /guru            → butuh role 'guru'
                /siswa           → butuh role 'siswa'
                        │
                   Salah role → redirect ke dashboard role yang benar
                        │
                        ▼
                   Pass through
                   (tulis ulang cookies jika baru di-refresh)
```

**Cookie config:**
| Cookie | Expire |
|---|---|
| `umbk-access-token` | 1 jam |
| `umbk-refresh-token` | 30 hari |
| Keduanya | HttpOnly, SameSite=Lax |
