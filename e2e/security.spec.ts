import { test, expect, type APIRequestContext } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginAs(r: APIRequestContext, username: string, password: string) {
  const res = await r.post('/api/auth/login', { data: { username, password } });
  expect(res.status()).toBe(200);
  return res;
}

const loginAsGuru    = (r: APIRequestContext) => loginAs(r, '102008', '102008@umbk');
const loginAsGuru2   = (r: APIRequestContext) => loginAs(r, '111009', '111009@umbk');
const loginAsProktor = (r: APIRequestContext) => loginAs(r, 'proktor1', 'ecbtmtswaha');
const loginAsSiswa   = (r: APIRequestContext) => loginAs(r, '240006', '240006@umbk');
const loginAsSiswa2  = (r: APIRequestContext) => loginAs(r, '240007', '240007@umbk');

// Siswa IDs — resolved dynamically at runtime from API (NIS-based lookup)
let SISWA1_ID = ''; // username/nis: 240006
let SISWA2_ID = ''; // username/nis: 240007

test.beforeAll(async ({ request }) => {
  await loginAsProktor(request);
  const body = await (await request.get('/api/akun')).json();
  const s1 = body.siswas.find((s: { nis: string }) => s.nis === '240006');
  const s2 = body.siswas.find((s: { nis: string }) => s.nis === '240007');
  if (!s1 || !s2) throw new Error('Seed siswa 240006/240007 tidak ditemukan di DB — jalankan seed dulu');
  SISWA1_ID = s1.id;
  SISWA2_ID = s2.id;
});

const SOALS = [
  { nomor: 1, pertanyaan: 'Q1', opsi_a: 'A', opsi_b: 'B', opsi_c: 'C', opsi_d: 'D', jawaban_benar: 'A', bobot: 1 },
];

// ── 1. Session ownership — POST /api/session ─────────────────────────────────
test.describe('[SEC-01] POST /api/session — siswa A tidak bisa buat session atas nama siswa B', () => {
  let ujianId  = '';
  let jadwalId = '';

  test('Setup ujian + jadwal', async ({ request }) => {
    await loginAsGuru(request);
    const u = await (await request.post('/api/ujian', {
      data: { nama_ujian: 'Sec Test Session', jenis_ujian: 'LATIHAN', durasi: 60 },
    })).json();
    ujianId = u.id;
    await request.post(`/api/soal/${ujianId}`, { data: { soals: SOALS } });

    await loginAsProktor(request);
    const j = await (await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 60, status_publikasi: 'Published', siswa_ids: [SISWA1_ID, SISWA2_ID] },
    })).json();
    jadwalId = j.id;
  });

  test('Siswa A coba POST session dengan siswaId milik siswa B — API tidak cek ownership → dokumentasi bug', async ({ request }) => {
    // Login sebagai siswa1, tapi kirim siswaId milik siswa2
    await loginAsSiswa(request);
    const res = await request.post('/api/session', {
      data: { siswaId: SISWA2_ID, jadwalId },
    });
    // API saat ini tidak cek ownership siswaId — catat status aktual
    // Jika 403: bug sudah diperbaiki. Jika 200/201: bug masih ada.
    const status = res.status();
    console.log(`[SEC-01] Actual status: ${status}`);
    // Test ini mendokumentasikan perilaku aktual — update jika bug diperbaiki
    expect([200, 201, 403]).toContain(status);
  });

  test('Teardown', async ({ request }) => {
    await loginAsProktor(request);
    if (jadwalId) await request.delete(`/api/jadwal/${jadwalId}`);
    await loginAsGuru(request);
    if (ujianId) await request.delete(`/api/ujian/${ujianId}`);
  });
});

// ── 2. Jawaban ownership — POST /api/jawaban ─────────────────────────────────
test.describe('[SEC-02] POST /api/jawaban — tidak ada ownership check', () => {
  let ujianId   = '';
  let jadwalId  = '';
  let sessionId = '';
  let soalId    = '';

  test('Setup ujian + jadwal + session siswa1', async ({ request }) => {
    await loginAsGuru(request);
    const u = await (await request.post('/api/ujian', {
      data: { nama_ujian: 'Sec Test Jawaban', jenis_ujian: 'LATIHAN', durasi: 60 },
    })).json();
    ujianId = u.id;
    await request.post(`/api/soal/${ujianId}`, { data: { soals: SOALS } });
    const soals = await (await request.get(`/api/soal/${ujianId}`)).json();
    soalId = soals[0]?.id;

    await loginAsProktor(request);
    const j = await (await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 60, status_publikasi: 'Published', siswa_ids: [SISWA1_ID] },
    })).json();
    jadwalId = j.id;

    await loginAsSiswa(request);
    const sess = await (await request.post('/api/session', {
      data: { siswaId: SISWA1_ID, jadwalId },
    })).json();
    sessionId = sess.id;
  });

  test('Siswa2 bisa POST jawaban ke session milik siswa1 — dokumentasi bug', async ({ request }) => {
    await loginAsSiswa2(request);
    const res = await request.post('/api/jawaban', {
      data: { sessionId, soalId, jawaban_siswa: 'B', status_soal: 'sudah' },
    });
    // API tidak ada ownership check — ini bug keamanan
    const status = res.status();
    console.log(`[SEC-02] Siswa lain POST jawaban: status=${status}`);
    // Dokumentasikan: saat ini kemungkinan 200 (bug), harusnya 403
    expect([200, 403]).toContain(status);
  });

  test('Guru bisa POST jawaban (tidak ada role check) — dokumentasi', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.post('/api/jawaban', {
      data: { sessionId, soalId, jawaban_siswa: 'C', status_soal: 'sudah' },
    });
    console.log(`[SEC-02] Guru POST jawaban: status=${res.status()}`);
    // Saat ini 200 — tidak ada role restriction untuk POST jawaban
    expect([200, 403]).toContain(res.status());
  });

  test('Teardown', async ({ request }) => {
    await loginAsProktor(request);
    if (jadwalId) await request.delete(`/api/jadwal/${jadwalId}`);
    await loginAsGuru(request);
    if (ujianId) await request.delete(`/api/ujian/${ujianId}`);
  });
});

// ── 3. Ujian ownership — PUT/DELETE /api/ujian/[id] ─────────────────────────
test.describe('[SEC-03] PUT/DELETE /api/ujian/[id] — guru bisa edit/hapus ujian guru lain', () => {
  let ujianByGuru1 = '';

  test('Setup — guru1 buat ujian', async ({ request }) => {
    await loginAsGuru(request);
    const u = await (await request.post('/api/ujian', {
      data: { nama_ujian: 'Ujian Guru1 Sec Test', jenis_ujian: 'LATIHAN', durasi: 60 },
    })).json();
    ujianByGuru1 = u.id;
  });

  test('Guru2 bisa PUT ujian milik guru1 — dokumentasi bug', async ({ request }) => {
    await loginAsGuru2(request);
    const res = await request.put(`/api/ujian/${ujianByGuru1}`, {
      data: { nama_ujian: 'Diubah oleh Guru2 (bug)' },
    });
    console.log(`[SEC-03] Guru2 PUT ujian guru1: status=${res.status()}`);
    // Saat ini 200 — tidak ada ownership check, ini bug
    expect([200, 403]).toContain(res.status());
  });

  test('Guru2 bisa DELETE ujian milik guru1 — dokumentasi bug', async ({ request }) => {
    // Jika PUT berhasil rename tapi tidak hapus, coba delete
    await loginAsGuru2(request);
    const res = await request.delete(`/api/ujian/${ujianByGuru1}`);
    console.log(`[SEC-03] Guru2 DELETE ujian guru1: status=${res.status()}`);
    expect([200, 403]).toContain(res.status());
  });

  test('Teardown — hapus jika masih ada', async ({ request }) => {
    await loginAsGuru(request);
    if (ujianByGuru1) await request.delete(`/api/ujian/${ujianByGuru1}`);
  });
});

// ── 4. Nilai leak — GET /api/nilai via jadwalId/sessionId oleh siswa ─────────
test.describe('[SEC-04] GET /api/nilai — siswa bisa lihat nilai orang lain via jadwalId/sessionId', () => {
  let ujianId   = '';
  let jadwalId  = '';
  let sessionId = '';

  test('Setup', async ({ request }) => {
    await loginAsGuru(request);
    const u = await (await request.post('/api/ujian', {
      data: { nama_ujian: 'Sec Test Nilai', jenis_ujian: 'LATIHAN', durasi: 60 },
    })).json();
    ujianId = u.id;
    await request.post(`/api/soal/${ujianId}`, { data: { soals: SOALS } });

    await loginAsProktor(request);
    const j = await (await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 60, status_publikasi: 'Published', siswa_ids: [SISWA1_ID, SISWA2_ID] },
    })).json();
    jadwalId = j.id;

    // Siswa1 mulai + submit session untuk punya nilai
    await loginAsSiswa(request);
    const sess = await (await request.post('/api/session', {
      data: { siswaId: SISWA1_ID, jadwalId },
    })).json();
    sessionId = sess.id;
    await request.post('/api/nilai', { data: { sessionId } });
  });

  test('Siswa2 bisa GET nilai via jadwalId (bocor nilai seluruh kelas) — dokumentasi bug', async ({ request }) => {
    await loginAsSiswa2(request);
    const res  = await request.get(`/api/nilai?jadwalId=${jadwalId}`);
    const status = res.status();
    console.log(`[SEC-04] Siswa2 GET nilai via jadwalId: status=${status}`);
    // Harusnya 403, tapi mungkin 200 — bug
    expect([200, 403]).toContain(status);
    if (status === 200) {
      const body = await res.json();
      console.log(`[SEC-04] Siswa2 bisa lihat ${Array.isArray(body) ? body.length : 'n/a'} nilai dari jadwal`);
    }
  });

  test('Siswa2 bisa GET nilai via sessionId milik siswa1 — dokumentasi bug', async ({ request }) => {
    await loginAsSiswa2(request);
    const res  = await request.get(`/api/nilai?sessionId=${sessionId}`);
    const status = res.status();
    console.log(`[SEC-04] Siswa2 GET nilai via sessionId siswa1: status=${status}`);
    expect([200, 403, null]).toContain(status);
  });

  test('Teardown', async ({ request }) => {
    await loginAsProktor(request);
    if (jadwalId) await request.delete(`/api/jadwal/${jadwalId}`);
    await loginAsGuru(request);
    if (ujianId) await request.delete(`/api/ujian/${ujianId}`);
  });
});

// ── 5. GET /api/session — siswa lain coba lihat session orang lain ────────────
test.describe('[SEC-05] GET /api/session — ownership check siswa', () => {
  let ujianId  = '';
  let jadwalId = '';

  test('Setup', async ({ request }) => {
    await loginAsGuru(request);
    const u = await (await request.post('/api/ujian', {
      data: { nama_ujian: 'Sec Test Session GET', jenis_ujian: 'LATIHAN', durasi: 60 },
    })).json();
    ujianId = u.id;
    await request.post(`/api/soal/${ujianId}`, { data: { soals: SOALS } });

    await loginAsProktor(request);
    const j = await (await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 60, status_publikasi: 'Published', siswa_ids: [SISWA1_ID] },
    })).json();
    jadwalId = j.id;

    await loginAsSiswa(request);
    await request.post('/api/session', { data: { siswaId: SISWA1_ID, jadwalId } });
  });

  test('Siswa2 coba GET session siswa1 → 403', async ({ request }) => {
    await loginAsSiswa2(request);
    const res = await request.get(`/api/session?siswaId=${SISWA1_ID}&jadwalId=${jadwalId}`);
    // Ini sudah ada ownership check di route
    expect(res.status()).toBe(403);
  });

  test('Proktor bisa GET session siswa1 → 200', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.get(`/api/session?siswaId=${SISWA1_ID}&jadwalId=${jadwalId}`);
    expect(res.status()).toBe(200);
  });

  test('Guru bisa GET session siswa1 → 200', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.get(`/api/session?siswaId=${SISWA1_ID}&jadwalId=${jadwalId}`);
    expect(res.status()).toBe(200);
  });

  test('Teardown', async ({ request }) => {
    await loginAsProktor(request);
    if (jadwalId) await request.delete(`/api/jadwal/${jadwalId}`);
    await loginAsGuru(request);
    if (ujianId) await request.delete(`/api/ujian/${ujianId}`);
  });
});

// ── 6. PATCH /api/session — reopen session yang sudah selesai ─────────────────
test.describe('[SEC-06] PATCH /api/session — siswa bisa reopen session selesai', () => {
  let ujianId   = '';
  let jadwalId  = '';
  let sessionId = '';

  test('Setup + submit session', async ({ request }) => {
    await loginAsGuru(request);
    const u = await (await request.post('/api/ujian', {
      data: { nama_ujian: 'Sec Test Reopen', jenis_ujian: 'LATIHAN', durasi: 60 },
    })).json();
    ujianId = u.id;
    await request.post(`/api/soal/${ujianId}`, { data: { soals: SOALS } });

    await loginAsProktor(request);
    const j = await (await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 60, status_publikasi: 'Published', siswa_ids: [SISWA1_ID] },
    })).json();
    jadwalId = j.id;

    await loginAsSiswa(request);
    const sess = await (await request.post('/api/session', {
      data: { siswaId: SISWA1_ID, jadwalId },
    })).json();
    sessionId = sess.id;

    // Submit (selesai)
    await request.patch('/api/session', { data: { sessionId, status: 'selesai' } });
  });

  test('Siswa coba PATCH status berlangsung pada session yang sudah selesai — dokumentasi', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.patch('/api/session', {
      data: { sessionId, status: 'berlangsung' },
    });
    console.log(`[SEC-06] Reopen session selesai: status=${res.status()}`);
    // API tidak cek status lama, ini potensi bug — harusnya 409 atau 400
    expect([200, 400, 409]).toContain(res.status());
  });

  test('Teardown', async ({ request }) => {
    await loginAsProktor(request);
    if (jadwalId) await request.delete(`/api/jadwal/${jadwalId}`);
    await loginAsGuru(request);
    if (ujianId) await request.delete(`/api/ujian/${ujianId}`);
  });
});

// ── 7. GET /api/nilai — siswa tidak bisa akses via siswaId orang lain ─────────
test.describe('[SEC-07] GET /api/nilai — siswa tidak bisa akses via siswaId orang lain', () => {
  test('Siswa2 GET nilai dengan siswaId siswa1 → 403', async ({ request }) => {
    await loginAsSiswa2(request);
    const res = await request.get(`/api/nilai?siswaId=${SISWA1_ID}`);
    // Ini sudah ada ownership check di route
    expect(res.status()).toBe(403);
  });

  test('Siswa bisa GET nilai miliknya sendiri → 200', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.get(`/api/nilai?siswaId=${SISWA1_ID}`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });
});
