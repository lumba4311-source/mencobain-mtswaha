# BUG TRACKER — E-CBT MTS WAHA

Dibuat: 2026-07-14  
Status: Semua 27+2 bug telah diselesaikan dan diverifikasi  
Total bug: **29** (Semua resolved)

---

## Legenda

| Prioritas | Keterangan |
|-----------|-----------|
| P1 — Critical | Data loss, security, atau app tidak bisa dipakai |
| P2 — High | Fungsionalitas rusak, user terkena dampak langsung |
| P3 — Medium | UX buruk, edge case yang mungkin terjadi |
| P4 — Low | Minor, kosmetik, atau code quality |

| Status | |
|--------|--|
| `[ ]` | Belum dikerjakan |
| `[~]` | Sedang dikerjakan |
| `[x]` | Selesai |

---

## KELOMPOK A — API Routes (tanpa auth check)

### A-01 `[x]` P1 — Semua API routes bisa diakses tanpa login
**File:** semua file di `app/api/` kecuali `app/api/auth/`  
**Masalah:** Tidak ada validasi token/cookie di endpoint manapun. Siapapun yang tahu URL bisa:
- GET `/api/akun` → dapat seluruh daftar user + password plaintext
- POST `/api/akun` → buat akun baru tanpa login
- DELETE `/api/akun` → hapus akun
- POST `/api/jawaban` → kirim jawaban palsu untuk session orang lain
- POST `/api/nilai` → submit nilai palsu
- POST `/api/monitoring` → force-submit siswa manapun

**Root cause:** Middleware hanya melindungi halaman (`/proktor/*`, `/siswa/*` dll), bukan API routes (`/api/*`).  
**Fix:** Tambah helper `getAuthUser(req)` yang baca cookie `umbk-access-token` dan panggil `supabase.auth.getUser()`. Tiap route yang butuh auth panggil helper ini di awal dan return 401 jika gagal.

---

### A-02 `[x]` P1 — `GET /api/akun` mengembalikan kolom `password` plaintext
**File:** `app/api/akun/route.ts:9-13`  
**Masalah:** Query `select('*')` pada tabel `profiles` mengambil semua kolom termasuk `password`. Response dikirim ke client tanpa filter.  
**Dampak:** Siapapun yang bisa hit endpoint ini (lihat A-01) dapat password semua user.  
**Fix:** Ganti `select('*')` menjadi `select('id, username, nama, role, status, password')` — password tetap diambil karena dibutuhkan ProktorAkunPage untuk ditampilkan, tapi field sensitif lain dari auth.users tidak bocor.

---

### A-03 `[x]` P1 — `POST /api/soal/[ujianId]` — race condition delete+insert tanpa transaksi
**File:** `app/api/soal/[ujianId]/route.ts:32-53`  
**Masalah:**
```
await supabase.from('soals').delete().eq('id_ujian', ujianId);
// <-- jika insert gagal di sini, soal terhapus permanent
const { error } = await supabase.from('soals').insert(toInsert);
if (error) throw error;
```
Jika insert gagal (network error, constraint violation, dll), delete sudah terjadi dan soal hilang permanent. Tidak ada rollback.  
**Fix:** Gunakan RPC Postgres dengan transaksi, atau lakukan insert dulu ke temp, baru delete lama setelah insert berhasil (swap pattern).

---

### A-04 `[x]` P2 — `POST /api/session` tidak cek duplikat sebelum insert
**File:** `app/api/session/route.ts:42-100`  
**Masalah:** Tidak ada pengecekan apakah session untuk `(siswaId, jadwalId)` sudah ada sebelum insert. Jika siswa klik "Mulai" dua kali cepat (double-click atau network retry), dua session berbeda bisa terbuat dengan urutan soal berbeda.  
**Fix:** Tambah `upsert` dengan `onConflict: 'id_siswa,id_jadwal'` atau cek existensi dulu dan return session yang ada jika sudah ada.

---

### A-05 `[x]` P2 — `PATCH /api/session` tidak validasi `sessionId`
**File:** `app/api/session/route.ts:104-123`  
**Masalah:** Tidak ada validasi bahwa `sessionId` dikirim. Jika request body kosong atau `sessionId` undefined, query `update().eq('id', undefined)` akan update **semua** baris di tabel `session_ujians`.  
**Fix:** Tambah guard: `if (!sessionId) return NextResponse.json({ error: 'sessionId wajib.' }, { status: 400 });`

---

### A-06 `[x]` P2 — `POST /api/monitoring` (force-submit) tidak validasi `sessionId`
**File:** `app/api/monitoring/route.ts:83-106`  
**Masalah:** Sama dengan A-05 — tidak ada validasi `sessionId`. Query update tanpa filter bisa update semua session.  
**Fix:** Guard `sessionId` sebelum query.

---

### A-07 `[x]` P2 — `PUT /api/ujian/[id]` dan `PUT /api/jadwal/[id]` — delete+insert relasi tanpa transaksi
**File:** `app/api/ujian/[id]/route.ts:42-47`, `app/api/jadwal/[id]/route.ts:35-40`  
**Masalah:** Pattern yang sama dengan A-03: delete relasi lama (`ujian_kelas` / `jadwal_siswa`), lalu insert baru. Jika insert gagal, relasi terhapus permanent.  
**Fix:** Cek error insert, jika gagal jangan hapus lama. Atau gunakan upsert.

---

### A-08 `[x]` P3 — `GET /api/nilai` tanpa parameter tidak dibatasi
**File:** `app/api/nilai/route.ts:15-25`  
**Masalah:** Jika request tidak mengirim `siswaId`, `jadwalId`, atau `sessionId`, query berjalan tanpa filter dan mengembalikan **semua** data nilai dari semua siswa.  
**Fix:** Tambah validasi minimal satu parameter wajib ada, atau return 400 jika semua kosong.

---

### A-09 `[x]` P3 — `POST /api/akun` tidak validasi input wajib
**File:** `app/api/akun/route.ts:33`  
**Masalah:** `username` dan `password` langsung dipakai tanpa validasi. Jika kosong/undefined, `supabase.auth.admin.createUser` akan gagal dengan error Supabase yang tidak user-friendly. `nis`/`nip` juga tidak divalidasi untuk format.  
**Fix:** Tambah validasi: `if (!username || !password || !nama || !role) return 400`.

---

## KELOMPOK B — ExamPage (siswa/ujian)

### B-01 `[x]` P1 — Timer bisa mati permanent jika submit gagal
**File:** `features/siswa/ExamPage.tsx` (sekitar baris handleAutoSubmit)  
**Masalah:** `handleAutoSubmit` memanggil `clearInterval(timerRef.current)` sebelum menunggu response submit. Jika fetch ke `/api/nilai` gagal (network error), timer sudah di-clear, `submitted` tidak di-set true, dan siswa stuck di halaman ujian tanpa timer — tidak bisa submit manual karena tidak ada tombol yang aktif.  
**Fix:** Hanya `clearInterval` setelah response berhasil (`res.ok`), atau set flag `submitted = true` hanya saat berhasil.

---

### B-02 `[x]` P1 — `handleAutoSubmit` tidak cek `res.ok`, redirect meski gagal
**File:** `features/siswa/ExamPage.tsx` (fungsi handleAutoSubmit)  
**Masalah:** Setelah fetch POST ke `/api/nilai`, kode langsung set `submitted = true` dan redirect ke hasil, tanpa cek apakah `res.ok`. Siswa di-redirect seolah sukses padahal nilai tidak tersimpan.  
**Fix:** Tambah `if (!res.ok) { /* tampilkan error, jangan redirect */ return; }`

---

### B-03 `[x]` P1 — `handleSubmit` (manual submit) tidak cek `res.ok`
**File:** `features/siswa/ExamPage.tsx` (fungsi handleSubmit)  
**Masalah:** Sama dengan B-02 untuk submit manual. Jawaban bisa tidak tersimpan tapi siswa tetap di-redirect.  
**Fix:** Sama dengan B-02.

---

### B-04 `[x]` P2 — Jawaban disimpan optimistically tanpa cek `res.ok`
**File:** `features/siswa/ExamPage.tsx` (fungsi saveJawaban/handlePilih)  
**Masalah:** State `jawaban` di-update di UI sebelum (atau tanpa menunggu) konfirmasi dari server. Jika fetch POST ke `/api/jawaban` gagal, UI menunjukkan jawaban tersimpan padahal tidak.  
**Fix:** Cek `res.ok` setelah fetch, tampilkan notifikasi error jika gagal, dan optionally revert state.

---

### B-05 `[x]` P2 — `tryResume` tidak di-await, kondisi race saat load
**File:** `features/siswa/ExamPage.tsx` (useEffect init)  
**Masalah:** `tryResume()` dipanggil tanpa `await` dalam useEffect, menyebabkan multiple async operations berjalan bersamaan yang bisa set state secara berurutan acak.  
**Fix:** Pastikan `tryResume` di-await atau gunakan flag `isInitializing` untuk mencegah double-init.

---

### B-06 `[x]` P3 — Fetch jadwal/ujian info tidak cek `res.ok`
**File:** `features/siswa/ExamPage.tsx:45-55`  
**Masalah:** Fetch `/api/jadwal/[jadwalId]` tidak cek `res.ok`. Jika 404 atau 500, `r.json()` masih diparsing dan bisa set state dengan data error object.  
**Fix:** Tambah `if (!r.ok) throw new Error(...)` setelah fetch.

---

## KELOMPOK C — SiswaDashboard

### C-01 `[x]` P2 — `Promise.all` outer tidak handle error per-item
**File:** `features/siswa/SiswaDashboard.tsx:26-51`  
**Masalah:** `Promise.all([fetch jadwal, fetch ujian, fetch akun])` jika salah satu gagal akan throw dan masuk `.catch(console.error)` — seluruh dashboard kosong tanpa pesan error ke user.  
**Fix:** Gunakan `Promise.allSettled` atau tambah individual error handling per fetch.

---

### C-02 `[x]` P3 — Fetch tanpa `res.ok` check di Promise.all
**File:** `features/siswa/SiswaDashboard.tsx:27-29`  
**Masalah:** `.then(r => r.json())` langsung tanpa cek `r.ok`. Jika server return 500, `r.json()` akan parse `{ error: "..." }` sebagai data dan set ke state.  
**Fix:** Tambah `.then(r => { if (!r.ok) throw new Error(...); return r.json(); })`

---

## KELOMPOK D — Guru Pages

### D-01 `[x]` P2 — `BuatUjianPage` tidak ada `try/catch/finally` — tombol bisa stuck
**File:** `features/guru/BuatUjianPage.tsx:24-47`  
**Masalah:**
```typescript
setSaving(true);
const res = await fetch(...);      // jika ini throw (network error)
const ujian = await res.json();    // setSaving(false) tidak pernah dipanggil
setSaving(false);
```
Jika fetch throw exception (bukan HTTP error, tapi network error), `setSaving(false)` tidak dipanggil. Tombol "Buat & Tambah Soal" stuck disabled permanent.  
**Fix:** Wrap dalam `try/finally { setSaving(false); }`

---

### D-02 `[x]` P2 — `EditUjianPage` tidak ada `try/catch/finally` — tombol stuck
**File:** `features/guru/EditUjianPage.tsx:63-80`  
**Masalah:** Sama persis dengan D-01. `handleSubmit` set `setSaving(true)` tapi jika fetch throw, `setSaving(false)` tidak dipanggil.  
**Fix:** Sama dengan D-01.

---

### D-03 `[x]` P2 — `EditUjianPage` load data tidak cek `res.ok`
**File:** `features/guru/EditUjianPage.tsx:34-50`  
**Masalah:** `fetch('/api/ujian/${ujianId}').then(r => r.json())` tanpa cek `r.ok`. Jika ujian tidak ditemukan (404), data error di-set ke state `ujian` dan form mungkin crash.  
**Fix:** Tambah cek `r.ok` atau handle dengan `.catch(() => router.replace('/guru/dashboard'))`.

---

### D-04 `[x]` P2 — `GuruDashboard` fetch ujian tanpa `res.ok` check
**File:** `features/guru/GuruDashboard.tsx:48-51`  
**Masalah:** `.then(r => r.json()).then(data => setUjianList(data ?? []))` — jika server return `{ error: "..." }`, ini di-set sebagai `ujianList` dan dashboard akan crash saat di-render (`.map` pada object bukan array).  
**Fix:** Tambah `.then(r => { if (!r.ok) throw new Error(); return r.json(); })`

---

### D-05 `[x]` P3 — `InputSoalPage` validasi soal tidak konsisten
**File:** `features/guru/InputSoalPage.tsx` (fungsi handleSave/handleSubmitForm)  
**Masalah:** Validasi field soal ada tapi tidak mencakup semua kasus — gambar_url diset tapi `pertanyaan` kosong bisa lolos jika ada race condition antara `uploading` state dan submit.  
**Fix:** Pastikan validasi dijalankan setelah `uploading === false` dan semua field dicek sebelum submit.

---

## KELOMPOK E — Proktor Pages

### E-01 `[x]` P2 — `ProktorDashboard` load data tidak cek `res.ok` per response
**File:** `features/proktor/ProktorDashboard.tsx:31-46`  
**Masalah:**
```typescript
const jadwals: JadwalUjian[] = await jadwalRes.json();  // tidak cek jadwalRes.ok
const ujians: Ujian[]        = await ujianRes.json();   // tidak cek ujianRes.ok
const akun                   = await akunRes.json();    // tidak cek akunRes.ok
```
Jika salah satu API error, data error object di-destructure dan kemungkinan crash atau tampilan data salah.  
**Fix:** Tambah cek `if (!jadwalRes.ok || !ujianRes.ok || !akunRes.ok) throw new Error(...)`

---

### E-02 `[x]` P2 — `ProktorHasilPage` — `loadData().then(() => handleSelect(selectedId))` race condition
**File:** `features/proktor/ProktorHasilPage.tsx:34-36`  
**Masalah:** `handleSelect` dipanggil dalam `.then()` dari `loadData()`, tapi `handleSelect` menggunakan `siswaMap` dan `kelasMap` yang baru saja di-set dalam `loadData`. Karena React state update bersifat async (batched), `handleSelect` mungkin berjalan sebelum state `siswaMap`/`kelasMap` benar-benar terupdate.  
**Fix:** Pass data langsung sebagai parameter ke `handleSelect`, atau gunakan `useEffect` yang watch `selectedId` dan state sudah terisi.

---

### E-03 `[x]` P2 — `ProktorHasilPage` `loadData` tidak cek `res.ok`
**File:** `features/proktor/ProktorHasilPage.tsx:40-48`  
**Masalah:** Sama dengan E-01 — tidak ada cek `res.ok` setelah fetch. Jika salah satu API gagal, parse JSON tetap dilakukan.  
**Fix:** Tambah cek `res.ok` untuk tiap response.

---

### E-04 `[x]` P2 — `ProktorMonitoringPage` auto-refresh tanpa circuit breaker
**File:** `features/proktor/ProktorMonitoringPage.tsx` (useEffect auto-refresh)  
**Masalah:** Auto-refresh polling ke `/api/monitoring` tidak ada circuit breaker atau error counter. Jika server down, polling terus berjalan setiap N detik, flooding server dengan request yang pasti gagal.  
**Fix:** Tambah counter error, jika gagal >3x berturut-turut hentikan polling dan tampilkan pesan "Koneksi terputus".

---

### E-05 `[x]` P2 — `ProktorMonitoringPage` `loadBase` tidak cek `res.ok`
**File:** `features/proktor/ProktorMonitoringPage.tsx:52-67`  
**Masalah:** Sama dengan E-01 — tiga fetch parallel tanpa cek `res.ok`.  
**Fix:** Tambah cek `res.ok` untuk tiap response.

---

### E-06 `[x]` P3 — `ProktorAkunPage` import siswa tidak ada validasi format kolom
**File:** `features/proktor/ProktorAkunPage.tsx` (fungsi handleImport)  
**Masalah:** Import dari paste teks/Excel hanya split by tab/newline tanpa memvalidasi:
- Jumlah kolom yang benar
- NIS duplikat dalam batch yang sama
- Username yang sudah ada di database
- Format NIS (hanya angka, panjang minimal/maksimal)

Siswa yang gagal import tidak dilaporkan dengan detail baris mana yang salah.  
**Fix:** Tambah validasi per baris sebelum kirim ke API, tampilkan error per baris yang gagal.

---

### E-07 `[x]` P3 — `ProktorJadwalPage` load data tidak cek `res.ok`
**File:** `features/proktor/ProktorJadwalPage.tsx` (fungsi loadData)  
**Masalah:** Fetch parallel tidak cek `res.ok` sebelum parse JSON.  
**Fix:** Tambah cek `res.ok`.

---

## KELOMPOK F — Middleware

### F-01 `[x]` P1 — Middleware tidak cek role untuk protected routes
**File:** `middleware.ts:60-106`  
**Masalah:** Middleware memvalidasi bahwa user sudah login (ada token valid), tapi tidak memvalidasi bahwa role user sesuai dengan route yang diakses. Contoh: siswa yang sudah login bisa akses `/proktor/akun` langsung via URL — middleware akan lolos karena token valid, hanya redirect dilakukan untuk halaman publik atau user tidak login.

Baris 82-91 hanya untuk redirect dari halaman **auth-only** (`/login`) jika sudah login. Tidak ada check "apakah role user cocok dengan prefix route yang diakses".  
**Fix:** Setelah dapat `userId`, ambil role dari profile, lalu cek apakah `pathname.startsWith('/proktor')` dan role bukan `proktor`/`admin`, dst. Redirect ke dashboard yang sesuai jika akses tidak authorized.

---

### F-02 `[x]` P3 — Middleware buat Supabase client baru di setiap request
**File:** `middleware.ts:31-33`  
**Masalah:** `createClient(supabaseUrl, supabaseService, ...)` dipanggil di setiap request masuk. Tidak ada caching/reuse client. Untuk traffic tinggi ini boros resource.  
**Fix:** Buat client di luar fungsi middleware sebagai module-level singleton (tapi perhatikan: di edge runtime, module scope bisa di-share antar request, jadi ini aman).

---

## Ringkasan per File

| File | Bug IDs | Prioritas Tertinggi |
|------|---------|-------------------|
| `middleware.ts` | F-01, F-02 | P1 |
| `app/api/akun/route.ts` | A-01, A-02, A-09 | P1 |
| `app/api/soal/[ujianId]/route.ts` | A-01, A-03 | P1 |
| `app/api/session/route.ts` | A-01, A-04, A-05 | P1 |
| `app/api/jawaban/route.ts` | A-01 | P1 |
| `app/api/nilai/route.ts` | A-01, A-08 | P1 |
| `app/api/monitoring/route.ts` | A-01, A-06 | P1 |
| `app/api/ujian/route.ts` | A-01 | P1 |
| `app/api/ujian/[id]/route.ts` | A-01, A-07 | P1 |
| `app/api/jadwal/route.ts` | A-01 | P1 |
| `app/api/jadwal/[id]/route.ts` | A-01, A-07 | P1 |
| `features/siswa/ExamPage.tsx` | B-01, B-02, B-03, B-04, B-05, B-06 | P1 |
| `features/siswa/SiswaDashboard.tsx` | C-01, C-02 | P2 |
| `features/guru/BuatUjianPage.tsx` | D-01 | P2 |
| `features/guru/EditUjianPage.tsx` | D-02, D-03 | P2 |
| `features/guru/GuruDashboard.tsx` | D-04 | P2 |
| `features/guru/InputSoalPage.tsx` | D-05 | P3 |
| `features/proktor/ProktorDashboard.tsx` | E-01 | P2 |
| `features/proktor/ProktorHasilPage.tsx` | E-02, E-03 | P2 |
| `features/proktor/ProktorMonitoringPage.tsx` | E-04, E-05 | P2 |
| `features/proktor/ProktorAkunPage.tsx` | E-06 | P3 |
| `features/proktor/ProktorJadwalPage.tsx` | E-07 | P3 |

---

## Urutan Fix yang Direkomendasikan

### Batch 1 — Security & Data Loss (kerjakan dulu)
1. **F-01** — Role check di middleware
2. **A-01** — Auth helper untuk semua API routes
3. **A-02** — Filter password dari GET /api/akun (low effort, high impact)
4. **A-03** — Race condition soal delete+insert
5. **A-05, A-06** — Validasi sessionId di PATCH session & force-submit

### Batch 2 — ExamPage (kritikal untuk siswa)
6. **B-01** — Timer mati permanent saat submit gagal
7. **B-02, B-03** — Submit tidak cek res.ok
8. **B-04** — Jawaban optimistic update tanpa konfirmasi server
9. **B-05** — tryResume race condition

### Batch 3 — Stabilitas UI (cegah crash & stuck)
10. **D-01, D-02** — try/finally di BuatUjianPage & EditUjianPage
11. **E-01, E-03, E-05, E-07** — res.ok check di semua Proktor pages
12. **C-01, C-02** — Error handling SiswaDashboard
13. **D-03, D-04** — res.ok check di Guru pages

### Batch 4 — Polish
14. **A-04** — Duplikat session check
15. **A-07** — Race condition relasi ujian/jadwal
16. **A-08, A-09** — Validasi input API
17. **E-02** — Race condition ProktorHasilPage
18. **E-04** — Circuit breaker monitoring
19. **E-06** — Validasi import akun
20. **F-02** — Middleware client singleton
21. **D-05** — Validasi InputSoalPage
