# Product Requirements Document (PRD)
## UMBK — Ujian Mandiri Berbasis Komputer
### MTS WAHA

---

**Versi:** 1.1
**Tanggal:** 9 Juli 2026
**Status:** Draft

---

## 1. Latar Belakang

MTS WAHA adalah Madrasah Tsanawiyah (setingkat SMP) berbasis pesantren yang dikhususkan untuk santriwati (santri perempuan). Selama ini, pelaksanaan ujian masih menggunakan sistem berbasis kertas — penggandaan soal, pengawasan, hingga koreksi dilakukan secara manual.

Kendala utama yang mendorong digitalisasi:

- **Biaya cetak** tinggi setiap periode ujian
- **Koreksi manual** butuh waktu berhari-hari, nilai tidak bisa langsung diketahui
- **Risiko kecurangan** karena soal dan urutan jawaban identik untuk semua siswa
- **Tidak ada visibilitas real-time** bagi pengawas terhadap progres siswa
- **Dokumen soal** rawan hilang atau rusak

UMBK menggantikan proses ini dengan sistem ujian digital berbasis web yang berjalan di jaringan lokal sekolah (LAN), sehingga tidak bergantung pada koneksi internet saat ujian berlangsung.

---

## 2. Tujuan Produk

| Tujuan | Indikator Keberhasilan |
|---|---|
| Menghilangkan ujian berbasis kertas | 0 lembar soal dicetak per sesi ujian |
| Mempercepat penilaian | Nilai tersedia dalam hitungan detik setelah siswa submit |
| Meminimalisir kecurangan | Setiap siswa mendapat urutan soal dan opsi jawaban yang berbeda (Fisher-Yates) |
| Memberikan kontrol penuh kepada pengawas | Proktor dapat memantau dan force-submit secara real-time |
| Mempermudah pengelolaan soal | Guru dapat membuat, mengedit, dan menggunakan kembali bank soal kapan saja |
| Menjaga keberlangsungan ujian | Siswa dapat resume jika koneksi terputus tanpa kehilangan jawaban maupun sisa waktu |

---

## 3. Pengguna Sistem (Roles)

Sistem memiliki 4 role yang didefinisikan sebagai enum di database: `admin`, `proktor`, `guru`, `siswa`.

### 3.1 Siswa
Peserta ujian. Total **170 santriwati** terdaftar, tersebar di **7 kelas** (9A–9G), masing-masing dengan NIS unik. Siswa hanya dapat mengakses halaman ujian aktif dan melihat histori nilai ujian yang sudah mereka kerjakan.

### 3.2 Guru
Tenaga pengajar yang membuat dan mengelola bank soal. Setiap guru memiliki NIP unik dan dapat diampu ke satu atau lebih dari **13 mata pelajaran** (relasi `guru_mapel`). Guru hanya dapat mengelola ujian yang mereka buat sendiri (`id_guru` pada tabel `ujian`).

### 3.3 Proktor
Administrator operasional ujian. Memiliki wewenang penuh: mengelola semua akun, menjadwalkan sesi, membuka/menutup jadwal, memantau real-time, dan melakukan force-submit. Tercatat sebagai pembuka jadwal di kolom `dibuka_oleh` pada tabel `jadwal_ujian`.

### 3.4 Admin
Role sistem dengan akses tertinggi. Digunakan untuk konfigurasi tingkat infrastruktur.

---

## 4. Entitas Data Utama

Sistem dibangun di atas **14 tabel** yang saling berelasi. Berikut entitas bisnis utamanya:

### 4.1 Master Data

| Entitas | Tabel | Field Kunci | Keterangan |
|---|---|---|---|
| Pengguna | `users` | `username`, `role`, `status` | Login JWT, status `aktif`/`nonaktif` |
| Siswa | `siswa` | `nis`, `nama`, `id_kelas` | Terikat ke kelas dan tahun ajaran |
| Guru | `guru` | `nip`, `nama` | Terikat ke satu atau banyak mata pelajaran |
| Kelas | `kelas` | `nama_kelas`, `tingkat`, `tahun_ajaran` | Contoh: 9A, tahun ajaran 2025/2026 |
| Mata Pelajaran | `mata_pelajaran` | `nama_mapel` | 13 mapel (umum + pesantren) |
| Guru–Mapel | `guru_mapel` | `id_guru`, `id_mapel` | Relasi many-to-many, unik per pasangan |

### 4.2 Konten Ujian

| Entitas | Tabel | Field Kunci | Keterangan |
|---|---|---|---|
| Ujian | `ujian` | `nama_ujian`, `jenis_ujian`, `durasi`, `nilai_kkm`, `acak_soal`, `acak_opsi` | Bank soal per ujian, KKM default 75 |
| Ujian–Kelas | `ujian_kelas` | `id_ujian`, `id_kelas` | Satu ujian bisa berlaku untuk banyak kelas |
| Soal | `soal` | `pertanyaan`, `opsi_a`–`opsi_e`, `jawaban_benar`, `bobot`, `gambar_url` | Pilihan ganda, bobot per soal bisa berbeda |

### 4.3 Operasional Ujian

| Entitas | Tabel | Field Kunci | Keterangan |
|---|---|---|---|
| Jadwal Ujian | `jadwal_ujian` | `token`, `ruangan`, `max_capacity`, `waktu_mulai`, `waktu_selesai`, `status` | Token 8 karakter unik, kapasitas default 70 |
| Sesi Siswa | `session_ujian` | `urutan_soal` (JSONB), `urutan_opsi` (JSONB), `deadline`, `sisa_waktu`, `status` | State ujian per siswa, unik per pasangan jadwal–siswa |
| Jawaban | `jawaban` | `jawaban_siswa`, `benar_salah`, `waktu_jawab` | UPSERT per soal, conflict key `(id_session, id_soal)` |
| Nilai | `nilai` | `jumlah_benar`, `jumlah_salah`, `jumlah_kosong`, `nilai` | Dihitung otomatis saat submit, unik per session |

---

## 5. Proses Bisnis

### Gambaran Alur Kerja

```
[Guru]                    [Proktor]                      [Siswa]
   |                          |                               |
   | 1. Buat ujian &          |                               |
   |    input soal            |                               |
   |                          |                               |
   |                          | 2. Buat jadwal sesi &         |
   |                          |    assign siswa ke sesi       |
   |                          |                               |
   |                          | 3. Buka sesi → token 8 char   |
   |                          |    di-generate & dibagikan    |
   |                          |                               |
   |                          |                 4. Login → masukkan token
   |                          |                    → kerjakan soal (acak)
   |                          |                               |
   |                          | 5. Pantau real-time,          |
   |                          |    force-submit jika perlu    |
   |                          |                               |
   |                          | 6. Tutup sesi → status Selesai|
   |                          |                               |
   | 7. Lihat hasil &         |                               |
   |    rekap nilai           |                               |
```

---

### 5.1 Persiapan Ujian (Guru)

1. **Buat Ujian Baru** — Guru mengisi: nama ujian, mata pelajaran, jenis ujian (`UMBK`/`UAS`/`PAS`/`PTS`/`TRYOUT`/`LATIHAN`), durasi (menit), KKM (default 75), serta toggle `acak_soal` dan `acak_opsi`.

2. **Input Soal** — Tersedia dua mode:
   - **Input satu per satu** — form per soal: teks pertanyaan, opsi A–E, kunci jawaban, bobot nilai, gambar opsional (JPG/PNG, maks 2 MB).
   - **Edit massal** — seluruh soal ditampilkan dalam tabel bergaya spreadsheet, bisa diedit langsung baris per baris, disimpan sekaligus.

3. **Assign ke Kelas** — Satu ujian dapat ditautkan ke banyak kelas melalui tabel `ujian_kelas`.

**Output:** Bank soal tersimpan permanen di tabel `soal`, dapat digunakan ulang di jadwal manapun.

---

### 5.2 Penjadwalan Sesi (Proktor)

1. **Buat Jadwal** — Proktor memilih bank soal (`id_ujian`), mengisi nama ruangan, waktu mulai, waktu selesai, dan kapasitas maksimal (default 70 siswa). Token 8 karakter di-generate saat jadwal dibuka (bukan saat dibuat).

2. **Assign Peserta** — Siswa ditugaskan ke jadwal via tabel `session_ujian`. Satu jadwal hanya menampung satu sesi per siswa (`UNIQUE(id_jadwal, id_siswa)`).

3. **Siklus Status Jadwal:**

```
Terjadwal → Dibuka → Ditutup → Selesai
```

Siswa hanya bisa masuk ujian ketika status jadwal = `Dibuka`.

---

### 5.3 Pelaksanaan Ujian

#### Sisi Proktor — Buka & Awasi

1. Proktor membuka jadwal → sistem generate token 8 karakter unik (karakter ambigu O, I, 0, 1 dihindari) → token dibagikan ke siswa secara manual (papan tulis / proyektor).
2. Dasbor monitoring polling data real-time dari `session_ujian` + `nilai`. Data yang ditampilkan per siswa:

| Field | Sumber Data | Keterangan |
|---|---|---|
| Status | `session_ujian.status` | Belum Mulai / Mengerjakan / Selesai / Timeout |
| Progres | `session_ujian.jumlah_dijawab` / `urutan_soal.length` | Misal: "12 / 40" |
| Lama pengerjaan | Hitung dari `waktu_mulai` hingga sekarang | Format MM:SS atau HH:MM:SS |
| Sisa waktu | `deadline` − sekarang (server-side) | Berubah ke Timeout jika ≤ 0 |
| Nilai | `nilai.nilai` | Muncul setelah submit |

3. **Force Submit** — Proktor dapat memaksa pengumpulan jawaban siswa tertentu. Sistem memanggil `calculateAndSaveScore()` secara langsung di server.
4. **Auto-Timeout Sweep** — Setiap kali monitoring di-poll, server otomatis men-sweep peserta yang `deadline`-nya sudah lewat namun `status` masih `Aktif`. Update `waktu_selesai` dilakukan secara atomik (`IS NULL` guard) untuk mencegah race condition.
5. **Auto-Heal Missing Scores** — Jika ditemukan sesi berstatus `Selesai` namun tabel `nilai` kosong, server langsung menghitung dan menyimpan skor tanpa intervensi manual.

#### Sisi Siswa — Kerjakan Ujian

1. Login dengan username + password → JWT token disimpan di `localStorage`, redirect otomatis berdasarkan role.
2. Dasbor menampilkan daftar jadwal yang tersedia untuk siswa tersebut.
3. Siswa memasukkan token sesi 8 karakter → sistem memvalidasi token terhadap `jadwal_ujian.token` dan status `Dibuka`.
4. Saat ujian dimulai (`startExam`):
   - Soal diacak menggunakan algoritma **Fisher-Yates** per siswa
   - Urutan soal disimpan sebagai array ID di `session_ujian.urutan_soal` (JSONB)
   - Urutan opsi per soal disimpan di `session_ujian.urutan_opsi` (JSONB)
   - `deadline` dihitung: `waktu_mulai + durasi_menit` → disimpan ke DB sebagai sumber kebenaran tunggal
5. **Autosave** — Setiap kali siswa memilih jawaban, dikirim ke server via UPSERT ke tabel `jawaban`. Conflict key `(id_session, id_soal)` memastikan tidak ada duplikasi.
6. **Panel Navigasi Soal** — Status warna tiap nomor soal:
   - Abu-abu = belum dijawab
   - Hijau = sudah dijawab
   - Kuning = ditandai ragu-ragu
   - Border tebal = soal aktif saat ini
7. **Timer Server-Side** — Sisa waktu di-sync dari server via `getTimeRemaining()`, bukan dari jam browser. Tidak bisa dimanipulasi dari sisi klien.
8. **Resume** — Jika koneksi terputus, saat login kembali sistem memanggil `getExamState()` yang mengembalikan: sisa waktu aktual (dari `deadline`), semua jawaban yang sudah tersimpan, dan posisi soal terakhir.
9. **Auto-submit** — Ketika server mendeteksi `Date.now() > deadline`, sistem otomatis memanggil `submitExam()` dan melempar error `"Waktu ujian habis! Dikumpulkan otomatis."`.

---

### 5.4 Penilaian Otomatis

Penilaian dijalankan sepenuhnya di server (`calculateAndSaveScore()`) tanpa intervensi guru:

1. Ambil semua jawaban dari tabel `jawaban` untuk `id_session` yang bersangkutan
2. Bandingkan setiap `jawaban_siswa` dengan `soal.jawaban_benar`
3. Akumulasi `bobot` soal yang benar → hitung persentase → simpan ke tabel `nilai`
4. Update `benar_salah` di setiap baris `jawaban`
5. Hitung `lama_pengerjaan_detik` dan `sisa_waktu_submit_detik` → simpan ke `session_ujian`

**Data nilai yang tersimpan:**

| Kolom | Keterangan |
|---|---|
| `jumlah_benar` | Jumlah soal dijawab benar |
| `jumlah_salah` | Jumlah soal dijawab salah |
| `jumlah_kosong` | Jumlah soal tidak dijawab |
| `nilai` | Skor akhir (0–100, presisi 2 desimal) |
| `tanggal_selesai` | Timestamp pengumpulan |

Status lulus/tidak lulus ditentukan dengan membandingkan `nilai` terhadap `ujian.nilai_kkm`.

---

## 6. Fitur Utama

### 6.1 Keamanan & Integritas Ujian

| Fitur | Cara Kerja |
|---|---|
| Token sesi 8 karakter | Di-generate saat jadwal dibuka, karakter ambigu dihindari, unik per jadwal |
| Pengacakan Fisher-Yates | Urutan soal dan opsi diacak berbeda untuk setiap siswa, disimpan di JSONB |
| Autosave UPSERT | Setiap jawaban langsung tersimpan ke server, tidak hilang meski browser ditutup |
| Timer server-side | `deadline` disimpan di DB, sisa waktu dihitung dari server bukan browser |
| Auto-submit | Server otomatis kumpulkan jawaban saat `deadline` terlewat |
| Resume session | `getExamState()` mengembalikan state lengkap untuk melanjutkan ujian |
| Guard UNIQUE | `(id_jadwal, id_siswa)` mencegah siswa ikut satu jadwal lebih dari sekali |

### 6.2 Monitoring Real-Time

- Data di-poll dari endpoint monitoring yang menggabungkan `session_ujian` + `nilai` dalam satu query
- Auto-timeout sweep setiap kali endpoint di-poll (atomik, race-condition safe)
- Auto-heal: skor yang hilang dihitung ulang otomatis tanpa intervensi manual
- Tampil: status, progres (X/Total), lama pengerjaan, sisa waktu, nilai final

### 6.3 Manajemen Bank Soal

- Antarmuka input bergaya spreadsheet/Excel (edit massal sekaligus)
- Mendukung gambar per soal (JPG/PNG, maks 2 MB, disimpan di storage bucket)
- Soal pilihan ganda dengan opsi A–E (minimum A & B wajib, C–E opsional)
- Bobot nilai per soal bisa berbeda (`bobot NUMERIC(5,2) DEFAULT 1`)
- Bank soal bersifat permanen dan reusable lintas jadwal

### 6.4 Manajemen Akun Terpusat

- Proktor mengelola semua akun dari satu dasbor: tambah, edit, nonaktifkan, reset password
- Impor massal dari Excel untuk onboarding awal atau pergantian tahun ajaran
- Status akun `aktif`/`nonaktif` — akun nonaktif tidak bisa login
- Pengelolaan kelas dan tahun ajaran terintegrasi

### 6.5 Penilaian & Hasil

- Nilai keluar instan setelah submit — tidak ada koreksi manual sama sekali
- Rekap lengkap: nilai, rincian benar/salah/kosong, ranking, statistik kelas (tertinggi, terendah, rata-rata)
- Histori semua ujian tersimpan permanen dan bisa diakses kapan saja

---

## 7. Jenis & Konfigurasi Ujian

### Jenis Ujian (ENUM `jenis_ujian`)

| Value | Nama | Keterangan |
|---|---|---|
| `UMBK` | Ujian Mandiri Berbasis Komputer | Ujian utama sekolah |
| `UAS` | Ujian Akhir Semester | |
| `PAS` | Penilaian Akhir Semester | |
| `PTS` | Penilaian Tengah Semester | |
| `TRYOUT` | Try Out | Simulasi ujian |
| `LATIHAN` | Latihan | Ujian formatif/tidak resmi |

### Konfigurasi Per Ujian

| Setting | Default | Keterangan |
|---|---|---|
| `durasi` | — (wajib diisi) | Dalam menit |
| `nilai_kkm` | 75 | Threshold lulus/tidak lulus |
| `acak_soal` | `TRUE` | Acak urutan soal per siswa |
| `acak_opsi` | `TRUE` | Acak urutan opsi A–E per siswa |
| `tampil_hasil` | `FALSE` | Apakah siswa bisa lihat nilai setelah submit |

---

## 8. Mata Pelajaran yang Didukung

| Kelompok | Mata Pelajaran |
|---|---|
| Kurikulum Umum | Bahasa Indonesia, Matematika, IPA, IPS, Bahasa Inggris, PKN, Seni Budaya |
| Kurikulum Pesantren | Bahasa Arab, Al-Qur'an Hadist, Fikih, Sejarah Kebudayaan Islam (SKI), Aswaja, Akidah Akhlak |

---

## 9. Aturan Bisnis

| # | Aturan | Implementasi di Sistem |
|---|---|---|
| 1 | Satu siswa hanya bisa ikut satu kali per jadwal | `UNIQUE(id_jadwal, id_siswa)` di `session_ujian` |
| 2 | Token wajib dimasukkan untuk mulai ujian | Validasi token vs `jadwal_ujian.token` + status `Dibuka` |
| 3 | Kapasitas sesi maksimal 70 siswa | `max_capacity INT DEFAULT 70` di `jadwal_ujian` |
| 4 | KKM default 75, bisa diubah per ujian | `nilai_kkm NUMERIC(5,2) DEFAULT 75` di `ujian` |
| 5 | Guru hanya kelola ujian milik sendiri | Filter `id_guru` pada semua query ujian |
| 6 | Waktu dikontrol penuh oleh server | `deadline` disimpan di DB, dihitung ulang di setiap request |
| 7 | Jawaban benar minimal 1 per soal | Validasi `jawaban_benar IN ('A','B','C','D','E')` |
| 8 | Pengacakan berbeda per siswa | Fisher-Yates saat `startExam`, hasil disimpan di JSONB |
| 9 | Nilai dihitung di server, bukan client | `calculateAndSaveScore()` berjalan di Node.js backend |
| 10 | Auto-submit saat deadline lewat | Sweep di monitoring + `_checkTimeLimit()` di setiap request soal |

---

## 10. Navigasi & Halaman

### Siswa
```
login.html
  └── siswa/dashboard.html        (daftar jadwal aktif + histori nilai)
        └── exam.html             (halaman pengerjaan ujian)
```

### Guru
```
login.html
  └── guru/dashboard.html         (daftar ujian milik guru)
        └── guru/input-soal.html  (kelola soal: tab Tambah + tab Edit Massal)
```

### Proktor
```
login.html
  └── proktor/dashboard.html
        ├── Tab Jadwal            (buat/edit/buka/tutup jadwal, assign siswa)
        ├── Tab Monitoring        (live status semua siswa per jadwal)
        ├── Tab Akun Siswa        (tambah, edit, impor Excel, nonaktifkan)
        ├── Tab Akun Guru         (tambah, edit, impor Excel, nonaktifkan)
        ├── Tab Kelas             (kelola kelas dan tahun ajaran)
        └── Tab Hasil             (rekap nilai semua sesi)
```

---

## 11. Kapasitas & Batasan

| Aspek | Nilai |
|---|---|
| Total siswa terdaftar | 170 santriwati |
| Jumlah kelas | 7 (9A–9G) |
| Kapasitas per jadwal | Maks 70 siswa (`max_capacity`) |
| Jumlah mata pelajaran | 13 |
| Jenis ujian | 6 (enum) |
| Tipe soal | Pilihan ganda A–E saja (essay tidak didukung) |
| Panjang token | 8 karakter |
| Ukuran gambar soal | Maks 2 MB (JPG/PNG) |
| Presisi nilai | 2 desimal (`NUMERIC(5,2)`) |
| Jaringan | LAN (tidak butuh internet saat ujian) |
| Platform | Web browser, berbasis Node.js + Supabase (PostgreSQL) |

---

## 12. Alur Data Kritis

### Alur Autosave Jawaban
```
Siswa pilih opsi
  → POST /api/sessions/:id/answer
    → UPSERT ke tabel jawaban (conflict: id_session + id_soal)
      → update jumlah_dijawab di session_ujian
        → return 200 OK
```

### Alur Submit & Penilaian
```
Siswa klik Submit (atau deadline terlewat)
  → calculateAndSaveScore(sessionId)
    → Ambil semua jawaban dari tabel jawaban
    → Bandingkan dengan jawaban_benar di tabel soal
    → Hitung skor berdasarkan bobot
    → UPSERT ke tabel nilai
    → Update status session_ujian → 'Selesai'
    → Simpan lama_pengerjaan_detik + sisa_waktu_submit_detik
```

### Alur Resume Ujian
```
Siswa login kembali setelah disconnect
  → GET /api/sessions/:id/state
    → Baca urutan_soal + urutan_opsi dari session_ujian (JSONB)
    → Hitung sisa waktu: deadline - Date.now()
    → Ambil semua jawaban yang sudah tersimpan
    → Return state lengkap ke frontend
      → Frontend restore tampilan ujian dari posisi terakhir
```

---

## 13. Manfaat Bisnis

| Sebelum UMBK | Sesudah UMBK |
|---|---|
| Soal dicetak, biaya tinggi tiap periode | Soal digital, tanpa biaya cetak |
| Koreksi manual berhari-hari | Penilaian otomatis, nilai keluar instan |
| Urutan soal sama, potensi meniru tinggi | Pengacakan Fisher-Yates unik per siswa |
| Pengawas tidak tahu progres siswa secara detail | Monitoring real-time: status, progres, sisa waktu, nilai |
| Jawaban bisa hilang jika kertas rusak | Autosave UPSERT ke server, tidak ada kehilangan data |
| Arsip nilai manual, sulit diakses | Rekap nilai tersimpan permanen di database |
| Koneksi terputus = ujian gagal ulang | Resume otomatis dari state terakhir, deadline tetap akurat |
| Tidak ada kontrol waktu yang ketat | Timer server-side dengan auto-submit, tidak bisa dimanipulasi |

---

## 14. Asumsi & Prasyarat

- Setiap ruang ujian memiliki komputer/laptop yang cukup untuk setiap siswa
- Jaringan LAN sekolah stabil selama ujian berlangsung
- Server dinyalakan dan dapat diakses dari semua perangkat sebelum ujian dimulai
- Perangkat siswa memiliki browser modern yang mendukung JavaScript
- Token sesi dikomunikasikan secara manual oleh proktor di ruangan
- Guru telah menyiapkan bank soal sebelum proktor membuat jadwal

---

## 15. Design System

Terdapat tiga varian desain yang telah dibuat untuk sistem ini, semuanya menggunakan nama tema **"Academic Clarity"**. Untuk project baru, pilih salah satu varian sesuai preferensi tampilan.

---

### 15.1 Varian Desain

| Varian | File | Tema | Cocok Untuk |
|---|---|---|---|
| **A — Dark Forest** | `DESIGN.md` | Dark mode, hijau hutan + emas | Tampilan elegan, low-light environment |
| **B — Light Blue** | `DESIGN1.md` | Light mode, biru profesional | Tampilan formal, ruang terang |
| **C — Dark Forest Alt** | `DESIGN2.md` | Dark mode, identik dengan Varian A | Alternatif dengan penyesuaian minor |

---

### 15.2 Varian A & C — Dark Forest (Dark Mode)

Tema gelap dengan palet warna natural berbasis hijau hutan dan aksen emas. Cocok untuk ruang ujian dengan kondisi pencahayaan rendah.

**Palet Warna Utama:**

| Peran | Token | Hex |
|---|---|---|
| Background | `surface` / `background` | `#111415` |
| Surface card | `surface-container` | `#1d2021` |
| Surface elevated | `surface-container-highest` | `#323536` |
| Teks utama | `on-surface` | `#e1e3e4` |
| Teks sekunder | `on-surface-variant` | `#c1c8c2` |
| **Primary (Hijau Hutan)** | `primary` | `#a5d0b9` |
| Primary container | `primary-container` | `#1b4332` |
| **Secondary (Emas)** | `secondary` | `#ddc669` |
| Secondary container | `secondary-container` | `#695900` |
| Tertiary | `tertiary` | `#bbc9c9` |
| Error | `error` | `#ffb4ab` |
| Outline | `outline` | `#8b938d` |

**Tipografi:**

| Level | Font | Ukuran | Weight |
|---|---|---|---|
| `headline-xl` | Source Serif 4 | 48px / lh 56px | 700 |
| `headline-lg` | Source Serif 4 | 32px / lh 40px | 600 |
| `headline-lg-mobile` | Source Serif 4 | 28px / lh 36px | 600 |
| `body-md` | Hanken Grotesk | 16px / lh 24px | 400 |
| `body-sm` | Hanken Grotesk | 14px / lh 20px | 400 |
| `label-md` | Hanken Grotesk | 12px / lh 16px | 600, letter-spacing 0.05em |

**Panduan Komponen (Dark Forest):**
- **Buttons** — Primary: background Hijau Hutan dengan 2px bottom border Emas sebagai state aktif. Secondary: ghost style dengan border subtle. Teks selalu Hanken Grotesk Medium.
- **Input Fields** — Background lebih gelap dari card surface, border 1px Hijau Hutan. Saat fokus, border transisi ke Emas. Label uppercase `label-md` di atas field.
- **Cards** — Unit organisasi utama, gunakan warna `surface-container`. Header dalam card dapat dipisahkan dengan divider 1px subtle.
- **Chips & Tags** — Fill Hijau Hutan low-opacity dengan teks high-contrast. Chip Emas hanya untuk status "Unggulan" atau "Excellent".
- **Progress Indicators** — Track gelap dengan indikator Emas untuk kontras tinggi.

---

### 15.3 Varian B — Light Blue (Light Mode)

Tema terang dengan palet biru profesional. Cocok untuk ruang kelas dengan pencahayaan standar.

**Palet Warna Utama:**

| Peran | Token | Hex |
|---|---|---|
| Background | `surface` / `background` | `#f9f9ff` |
| Surface card | `surface-container` | `#e9edff` |
| Surface elevated | `surface-container-highest` | `#dbe2f9` |
| Teks utama | `on-surface` | `#141b2c` |
| Teks sekunder | `on-surface-variant` | `#404750` |
| **Primary (Biru Tua)** | `primary` | `#005182` |
| Primary container | `primary-container` | `#026aa7` |
| **Secondary (Biru Cyan)** | `secondary` | `#006685` |
| Secondary container | `secondary-container` | `#90dbff` |
| Error | `error` | `#ba1a1a` |
| Outline | `outline` | `#717881` |

**Tipografi:**

| Level | Font | Ukuran | Weight |
|---|---|---|---|
| `display-lg` | Inter | 48px / lh 60px | 700 |
| `headline-lg` | Inter | 32px / lh 40px | 600 |
| `headline-lg-mobile` | Inter | 24px / lh 32px | 600 |
| `title-md` | Inter | 20px / lh 28px | 600 |
| `body-lg` | Inter | 18px / lh 28px | 400 |
| `body-md` | Inter | 16px / lh 24px | 400 |
| `label-md` | Inter | 14px / lh 20px | 500 |
| `mono-timer` | JetBrains Mono | 24px / lh 32px | 600 |

**Panduan Komponen (Light Blue):**
- **Question Cards** — Padding `unit-lg` (24px). Teks pertanyaan gunakan `body-lg` (18px). Opsi jawaban tampil sebagai baris besar yang bisa di-tap dengan border 1px yang menebal dan berubah warna ke biru primary saat dipilih.
- **Data Tables** — "Clean Style": tidak ada border vertikal, divider horizontal 1px `#F2F4F7`, header sticky dengan background abu-abu muda.
- **Countdown Timer** — Pojok kanan atas halaman ujian, container fixed dengan font monospace (`JetBrains Mono`). Jika sisa waktu < 5 menit, teks berubah ke `error` dan animasi pulse subtle diizinkan pada border container.
- **Buttons:**
  - Primary: Fill biru solid, teks putih — untuk "Soal Berikutnya" atau "Submit"
  - Secondary: Fill putih, border abu-abu, teks abu-abu — untuk "Sebelumnya" atau "Simpan Draft"
  - Ghost: Tanpa fill, teks biru — untuk "Tandai Ragu-ragu"

---

### 15.4 Spacing & Layout (Berlaku Semua Varian)

| Token | Nilai | Keterangan |
|---|---|---|
| `unit` | 8px | Base spacing unit |
| `container-max` | 1200px | Lebar maksimal konten |
| `gutter` | 24px | Jarak antar kolom |
| `margin-desktop` | 64px | Margin kiri-kanan halaman desktop |

**Border Radius:**

| Token | Nilai |
|---|---|
| `rounded-sm` | 0.125rem |
| `rounded` (DEFAULT) | 0.25rem |
| `rounded-md` | 0.375rem |
| `rounded-lg` | 0.5rem |
| `rounded-xl` | 0.75rem |
| `rounded-full` | 9999px |

---

### 15.5 Panduan Warna Status Navigasi Soal

Berlaku untuk semua varian, warna status tombol navigasi soal di panel samping halaman ujian:

| Status | Warna | Keterangan |
|---|---|---|
| Belum dijawab | Abu-abu (`outline-variant`) | Default |
| Sudah dijawab | Hijau (`primary` Varian A/C) / Biru (`primary` Varian B) | Jawaban tersimpan |
| Ragu-ragu | Kuning / Emas (`secondary`) | Ditandai untuk ditinjau ulang |
| Soal aktif | Border tebal warna `primary` | Soal yang sedang ditampilkan |

---

*Dokumen ini mendeskripsikan sistem UMBK dari perspektif proses bisnis, alur data, spesifikasi fungsional, dan panduan desain. Dokumen ini dirancang sebagai acuan untuk pengembangan sistem serupa.*
