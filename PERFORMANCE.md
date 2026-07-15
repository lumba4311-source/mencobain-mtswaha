# Dokumentasi Perbaikan Performa — E-CBT MTS WAHA
> Target: 70 siswa ujian bersamaan di server 192.168.150.243

---

## Estimasi Beban Saat Ujian Berlangsung

| Sumber Request | Interval | req/menit (70 siswa) |
|----------------|----------|----------------------|
| `PATCH /api/session` sisa_waktu | 30 detik | 140 |
| `GET /api/session` cek force_submit | 20 detik | 210 |
| `POST /api/jawaban` pilih jawaban | ~1x/30 detik | 140 |
| `GET /api/monitoring` polling proktor | 5 detik | 24 |
| **Total** | | **~514 req/menit** |

Setiap request memanggil `getAuthUser()` = **2 DB round-trips** (auth + profiles).
Total DB queries: **~1.028 query/menit** hanya untuk autentikasi.

---

## Daftar Perbaikan

### P1 — N+1 Loop di Penilaian (KRITIS)
**File:** `app/api/nilai/route.ts:100–116`

**Masalah:**
```
for (const soal of soals) {
  await supabase.from('jawabans').update(...).eq(...) // dipanggil per soal!
}
```
Dengan 40 soal × 70 siswa submit bersamaan = **2.800 UPDATE sequential**.
Ini bottleneck terbesar saat ujian selesai — bisa menyebabkan timeout massal.

**Solusi:** Ganti loop `await` dengan satu bulk UPDATE menggunakan PostgreSQL `CASE WHEN`
via Supabase RPC, atau cukup skip update `benar_salah` per-baris dan hitung di memory saja
(nilai sudah dihitung dari `jawabanMap`, update `benar_salah` hanya metadata opsional).

**Fix minimal (tanpa ubah skema):**
```typescript
// Ganti loop await dengan satu Promise.all
await Promise.all(
  (soals ?? []).map((soal) => {
    const jawaban = jawabanMap.get(soal.id);
    return supabase
      .from('jawabans')
      .update({ benar_salah: jawaban ? jawaban === soal.jawaban_benar : null })
      .eq('id_session', sessionId)
      .eq('id_soal', soal.id);
  })
);
```
`Promise.all` mengirim semua query paralel — dari 40 sequential round-trips menjadi
1 batch paralel.

**Test yang harus dibuat:** `__tests__/perf.nilai.test.ts`
- Verifikasi update `benar_salah` dipanggil paralel, bukan sequential
- Verifikasi nilai dihitung benar untuk 40 soal
- Verifikasi idempotent — submit kedua return nilai yang sama

---

### P2 — Double DB Round-Trip di Setiap Request (KRITIS)
**File:** `lib/apiAuth.ts:27–35`

**Masalah:**
```
const { user } = await supabase.auth.getUser(token)  // round-trip 1
const { profile } = await supabase.from('profiles')   // round-trip 2
```
Dipanggil di **setiap** API route — 514 req/menit × 2 = **1.028 DB queries/menit** hanya auth.

**Solusi:** Decode JWT secara lokal untuk ambil `role` dari custom claims,
skip query `profiles` sama sekali. Role bisa di-embed ke JWT saat login
via Supabase `auth.users.raw_app_meta_data`.

**Alternatif lebih mudah (tanpa ubah auth flow):** Cache result `getAuthUser`
per token dalam Map dengan TTL 30 detik menggunakan Node.js module-level cache:
```typescript
const cache = new Map<string, { result: AuthUser; exp: number }>();

export async function getAuthUser(req): Promise<AuthUser | null> {
  const token = extractToken(req);
  if (!token) return null;

  const cached = cache.get(token);
  if (cached && cached.exp > Date.now()) return cached.result;

  // ... existing logic ...

  cache.set(token, { result: { id: user.id, role: profile.role }, exp: Date.now() + 30_000 });
  return { id: user.id, role: profile.role };
}
```
Cache dibersihkan otomatis karena Map di-replace tiap entry expired.

**Test yang harus dibuat:** `__tests__/perf.apiAuth.test.ts`
- Verifikasi DB hanya dipanggil sekali untuk token yang sama dalam 30 detik
- Verifikasi cache miss setelah TTL expired
- Verifikasi token berbeda tidak cross-cache

---

### P3 — Tidak Ada Connection Pooling (KRITIS)
**File:** `docker-compose.yml` (di server `/home/ubuntu/ecbt_mtswaha/`)

**Masalah:** PostgreSQL default `max_connections=100`. Setiap `createClient()` bisa
membuka koneksi baru. Dengan burst 70 siswa submit bersamaan, pool bisa exhausted.

**Solusi:** Tambahkan PgBouncer ke `docker-compose.yml`:
```yaml
ecbt_pgbouncer:
  image: edoburu/pgbouncer:latest
  environment:
    DB_HOST: ecbt_db
    DB_USER: postgres
    DB_PASSWORD: your_password
    DB_NAME: postgres
    POOL_MODE: transaction
    MAX_CLIENT_CONN: 200
    DEFAULT_POOL_SIZE: 20
  ports:
    - "5432:5432"
  depends_on:
    - ecbt_db
```
Ubah `DATABASE_URL` di `.env` untuk pointing ke PgBouncer, bukan langsung ke `ecbt_db`.

**Test:** Load test manual — login 70 akun bersamaan dan cek `pg_stat_activity` di DB.

---

### P4 — Polling Monitoring Terlalu Agresif (TINGGI)
**File:** `features/proktor/ProktorMonitoringPage.tsx:120`

**Masalah:**
```typescript
const t = setInterval(refresh, 5000); // 5 detik
```
`refresh` memanggil `GET /api/monitoring` yang menjalankan **5 query serial** ke DB.
Dengan 3 tab proktor terbuka = 18 req/menit × 5 query = **90 DB queries/menit** hanya monitoring.

**Solusi:** Naikkan interval ke 10 detik:
```typescript
const t = setInterval(refresh, 10_000);
```
Dampak UX minimal — proktor melihat update setiap 10 detik masih cukup real-time.

**Test yang harus dibuat:** `__tests__/perf.monitoring.test.ts`
- Verifikasi interval tidak lebih cepat dari 10 detik
- Verifikasi tidak ada memory leak (interval di-clear saat unmount)

---

### P5 — `select('*')` di Monitoring Ambil Kolom Tidak Perlu (TINGGI)
**File:** `app/api/monitoring/route.ts:34,41`

**Masalah:**
```typescript
await supabase.from('siswas').select('*')       // semua kolom termasuk foto base64
await supabase.from('session_ujians').select('*') // semua kolom termasuk urutan_soal JSON besar
```
Kolom `urutan_soal` dan `urutan_opsi` di `session_ujians` bisa berukuran besar (array 40 soal).
Dikirim ke klien tapi tidak dipakai di halaman monitoring.

**Solusi:** Pilih kolom spesifik:
```typescript
await supabase.from('siswas').select('id, nama, nis')
await supabase.from('session_ujians').select('id, id_siswa, id_jadwal, status, sisa_waktu, deadline')
```

**Test yang harus dibuat:** `__tests__/perf.monitoring.test.ts`
- Verifikasi kolom `urutan_soal` tidak ada di response
- Verifikasi field yang dibutuhkan (`nama`, `status`, `sisa_waktu`) tetap ada

---

### P6 — PATCH sisa_waktu Redundan (SEDANG)
**File:** `features/siswa/ExamPage.tsx:118–122`

**Masalah:**
```typescript
fetch('/api/session', {
  method: 'PATCH',
  body: JSON.stringify({ sessionId: ses.id, sisa_waktu: sisaFromDeadline }),
})
```
Setiap 30 detik × 70 siswa = **140 req/menit** untuk menyimpan data yang bisa dihitung
dari `deadline - Date.now()`. Source of truth sudah ada di `ses.deadline`.

**Solusi:** Hapus `fetch` PATCH sisa_waktu, pertahankan re-sync dari deadline:
```typescript
saveTimerRef.current = setInterval(() => {
  const ses = sessionRef.current;
  if (!ses) return;

  const sisaFromDeadline = Math.max(
    0,
    Math.floor((new Date(ses.deadline).getTime() - Date.now()) / 1000)
  );
  setTimeLeft(sisaFromDeadline);
  timeLeftRef.current = sisaFromDeadline;

  if (sisaFromDeadline <= 0) {
    clearInterval(timerRef.current!);
    clearInterval(saveTimerRef.current!);
    handleAutoSubmit();
  }
  // HAPUS: fetch PATCH sisa_waktu
}, 30_000);
```

**Test yang harus dibuat:** `__tests__/perf.examPage.test.ts`
- Verifikasi `PATCH /api/session` tidak dipanggil setiap 30 detik
- Verifikasi countdown tetap akurat dari `deadline`
- Verifikasi auto-submit tetap terpanggil saat `sisaFromDeadline <= 0`

---

### P7 — Composite Index Jawabans (SEDANG)
**File:** `supabase/schema.sql` atau migration baru

**Masalah:** Query `jawabans` di monitoring dan penilaian sering filter `id_session + jawaban_siswa`
tapi tidak ada composite index untuk kombinasi tersebut.

**Solusi:** Tambahkan index via migration:
```sql
-- Untuk query di monitoring/route.ts:49-53
CREATE INDEX IF NOT EXISTS idx_jawabans_session_jawaban
  ON jawabans (id_session, jawaban_siswa)
  WHERE jawaban_siswa IS NOT NULL;

-- Untuk query di nilai/route.ts:87-90
CREATE INDEX IF NOT EXISTS idx_jawabans_session_soal
  ON jawabans (id_session, id_soal);
```

**Test:** `EXPLAIN ANALYZE` di psql setelah index dibuat — pastikan `Index Scan` bukan `Seq Scan`.

---

## Prioritas dan Urutan Implementasi

| No | ID | Dampak | Effort | Risiko Bug Baru |
|----|-----|--------|--------|-----------------|
| 1 | P1 | 🔴 Kritis | 30 menit | Rendah — hanya ganti sequential jadi parallel |
| 2 | P2 | 🔴 Kritis | 2 jam | Sedang — test cache invalidation |
| 3 | P3 | 🔴 Kritis | 30 menit | Rendah — infra only |
| 4 | P4 | 🟠 Tinggi | 5 menit | Sangat rendah |
| 5 | P5 | 🟠 Tinggi | 30 menit | Rendah — perlu cek kolom yang dipakai di UI |
| 6 | P6 | 🟡 Sedang | 15 menit | Rendah — test countdown masih jalan |
| 7 | P7 | 🟡 Sedang | 15 menit | Sangat rendah — DDL only |

**Rekomendasi urutan:** P1 → P4 → P6 → P5 → P7 → P2 → P3

P1, P4, P6 bisa selesai dalam 1 jam dan sudah mengurangi beban ~40%.
P2 dan P3 adalah perubahan arsitektur — perlu testing lebih teliti.

---

## Checklist Testing Sebelum Deploy

Setiap perbaikan wajib lolos checklist berikut sebelum di-push ke server:

### Unit Test (Jest)
- [ ] `npm test` — semua 94 test masih pass setelah perubahan
- [ ] Test baru untuk setiap fix ditambahkan di `__tests__/`
- [ ] Tidak ada `console.error` baru yang bukan dari error path yang disengaja

### Manual Test (Browser)
- [ ] Login sebagai siswa — soal tampil, timer berjalan
- [ ] Pilih jawaban — tersimpan (tidak hilang saat refresh)
- [ ] Submit ujian — nilai muncul, status session menjadi `selesai`
- [ ] Timer habis — auto-submit berjalan, tidak stuck di halaman ujian
- [ ] Login sebagai proktor — monitoring tampil, refresh otomatis
- [ ] Force submit dari proktor — session siswa berubah ke `force_submit`

### Regression Test Spesifik per Fix

| Fix | Regression yang harus dicek |
|-----|------------------------------|
| P1 (parallel update) | Nilai tetap dihitung benar, tidak ada race condition di concurrent submit |
| P2 (auth cache) | Logout langsung efektif (cache tidak return user yang sudah logout) |
| P4 (interval 10s) | Monitoring masih update, tidak ada stale data lebih dari 10 detik |
| P5 (select spesifik) | Semua kolom yang ditampilkan di UI monitoring masih ada |
| P6 (hapus PATCH timer) | Countdown tidak drift, auto-submit tetap akurat |

### Load Test (setelah semua fix)
Simulasi 70 siswa menggunakan `k6` atau `ab`:
```bash
# Contoh dengan Apache Bench — 70 concurrent, 420 total request (simulasi 1 menit)
ab -n 420 -c 70 -H "Cookie: umbk-access-token=TOKEN" \
   http://192.168.150.243:3000/api/session?siswaId=test
```
Target: response time p95 < 500ms, tidak ada error 5xx.

---

## File Test yang Perlu Dibuat

```
__tests__/
  perf.nilai.test.ts        — P1: parallel update benar_salah
  perf.apiAuth.test.ts      — P2: cache getAuthUser
  perf.monitoring.test.ts   — P4 + P5: interval & select spesifik
  perf.examPage.test.ts     — P6: hapus PATCH timer
```

Tambahkan ke suite yang sudah ada — jalankan dengan `npm test`.
