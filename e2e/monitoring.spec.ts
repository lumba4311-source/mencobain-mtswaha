import { test, expect, type APIRequestContext } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginAs(r: APIRequestContext, username: string, password: string) {
  const res = await r.post('/api/auth/login', { data: { username, password } });
  expect(res.status()).toBe(200);
  return res;
}

const loginAsGuru    = (r: APIRequestContext) => loginAs(r, '102008', '102008@umbk');
const loginAsProktor = (r: APIRequestContext) => loginAs(r, 'proktor1', 'ecbtmtswaha');
const loginAsSiswa   = (r: APIRequestContext) => loginAs(r, '240006', '240006@umbk');
const loginAsSiswa2  = (r: APIRequestContext) => loginAs(r, '240007', '240007@umbk');

const SOALS = [
  { nomor: 1, pertanyaan: 'S1', opsi_a: 'A', opsi_b: 'B', opsi_c: 'C', opsi_d: 'D', jawaban_benar: 'A', bobot: 1 },
  { nomor: 2, pertanyaan: 'S2', opsi_a: 'A', opsi_b: 'B', opsi_c: 'C', opsi_d: 'D', jawaban_benar: 'B', bobot: 1 },
  { nomor: 3, pertanyaan: 'S3', opsi_a: 'A', opsi_b: 'B', opsi_c: 'C', opsi_d: 'D', jawaban_benar: 'C', bobot: 1 },
];

let ujianId  = '';
let jadwalId = '';
let siswaId  = '';
let sessionId = '';

// ── 1. Setup ──────────────────────────────────────────────────────────────────
test.describe('Setup monitoring', () => {
  test('Guru buat ujian + soal, proktor buat jadwal, siswa buat session', async ({ request }) => {
    // Guru buat ujian
    await loginAsGuru(request);
    const u = await (await request.post('/api/ujian', {
      data: { nama_ujian: 'Monitoring Test', jenis_ujian: 'LATIHAN', durasi: 60, acak_soal: false },
    })).json();
    ujianId = u.id;
    await request.post(`/api/soal/${ujianId}`, { data: { soals: SOALS } });

    // Ambil siswaId
    await loginAsSiswa(request);
    const me = await (await request.get('/api/auth/me')).json();
    siswaId  = me.siswa?.id;
    expect(siswaId).toBeTruthy();

    // Proktor buat jadwal + assign siswa
    await loginAsProktor(request);
    const j = await (await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 60, status_publikasi: 'Published', siswa_ids: [siswaId] },
    })).json();
    jadwalId = j.id;
    expect(jadwalId).toBeTruthy();

    // Siswa buat session
    await loginAsSiswa(request);
    const sess = await (await request.post('/api/session', { data: { siswaId, jadwalId } })).json();
    sessionId = sess.id;
    expect(sessionId).toBeTruthy();
  });
});

// ── 2. GET /api/monitoring ────────────────────────────────────────────────────
test.describe('GET /api/monitoring', () => {
  test('Proktor bisa GET monitoring dengan jadwalId yang valid', async ({ request }) => {
    await loginAsProktor(request);
    const res  = await request.get(`/api/monitoring?jadwalId=${jadwalId}`);
    expect(res.status()).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    // Entry diidentifikasi via siswa.id (bukan root siswa_id)
    const entry = list.find((e: { siswa: { id: string } }) => e.siswa?.id === siswaId);
    expect(entry).toBeTruthy();
  });

  test('Response monitoring mengandung field status session', async ({ request }) => {
    await loginAsProktor(request);
    const res  = await request.get(`/api/monitoring?jadwalId=${jadwalId}`);
    const list = await res.json();
    const entry = list.find((e: { siswa: { id: string } }) => e.siswa?.id === siswaId);
    expect(entry).toHaveProperty('status');
    // Status bisa berlangsung atau force_submit tergantung run sebelumnya
    expect(['berlangsung', 'force_submit', 'selesai']).toContain(entry.status);
  });

  test('Response monitoring mengandung jumlahDijawab', async ({ request }) => {
    await loginAsProktor(request);
    const res   = await request.get(`/api/monitoring?jadwalId=${jadwalId}`);
    const list  = await res.json();
    const entry = list.find((e: { siswa: { id: string } }) => e.siswa?.id === siswaId);
    expect(entry).toHaveProperty('jumlahDijawab');
  });

  test('Siswa tidak bisa GET monitoring → 403', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.get(`/api/monitoring?jadwalId=${jadwalId}`);
    expect(res.status()).toBe(403);
  });

  test('Guru tidak bisa GET monitoring → 403', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.get(`/api/monitoring?jadwalId=${jadwalId}`);
    expect(res.status()).toBe(403);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.get(`/api/monitoring?jadwalId=${jadwalId}`);
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test('Tanpa jadwalId → 400', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.get('/api/monitoring');
    expect(res.status()).toBe(400);
  });

  test('jadwalId tidak ditemukan → 404', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.get('/api/monitoring?jadwalId=00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(404);
  });

  test('Jadwal tanpa siswa mengembalikan array kosong', async ({ request }) => {
    await loginAsProktor(request);
    // Buat jadwal tanpa siswa
    const j = await (await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 60, status_publikasi: 'Draft', siswa_ids: [] },
    })).json();

    const res  = await request.get(`/api/monitoring?jadwalId=${j.id}`);
    expect(res.status()).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    expect(list.length).toBe(0);

    // Cleanup
    await request.delete(`/api/jadwal/${j.id}`);
  });
});

// ── 3. POST /api/monitoring — force submit ────────────────────────────────────
test.describe('POST /api/monitoring — force submit', () => {
  // Flow: setup → force submit → cek status → idempoten (satu test agar state tidak hilang)
  test('Full force submit flow: setup, submit, cek status, idempoten', async ({ request }) => {
    // Setup: siswa2 buat session di jadwal baru
    await loginAsSiswa2(request);
    const me = await (await request.get('/api/auth/me')).json();
    const fsSiswaId = me.siswa?.id;
    expect(fsSiswaId).toBeTruthy();

    await loginAsProktor(request);
    const j = await (await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 60, status_publikasi: 'Published', siswa_ids: [fsSiswaId] },
    })).json();
    const fsJadwalId = j.id;
    expect(fsJadwalId).toBeTruthy();

    await loginAsSiswa2(request);
    const sess = await (await request.post('/api/session', {
      data: { siswaId: fsSiswaId, jadwalId: fsJadwalId },
    })).json();
    const fsSessionId = sess.id;
    expect(fsSessionId).toBeTruthy();

    // Force submit → 200 + nilai
    await loginAsProktor(request);
    const res1 = await request.post('/api/monitoring', { data: { sessionId: fsSessionId } });
    expect(res1.status()).toBe(200);
    const body1 = await res1.json();
    expect(body1.ok).toBe(true);
    expect(body1).toHaveProperty('nilai');

    // Cek status berubah ke selesai/force_submit via GET monitoring
    // (hitungDanSimpanNilai mengubah status ke 'selesai' setelah force_submit)
    const list = await (await request.get(`/api/monitoring?jadwalId=${fsJadwalId}`)).json();
    const entry = list.find((e: { siswa: { id: string } }) => e.siswa?.id === fsSiswaId);
    expect(entry).toBeTruthy();
    expect(['force_submit', 'selesai']).toContain(entry.status);

    // Force submit kedua kali → 409
    const res2 = await request.post('/api/monitoring', { data: { sessionId: fsSessionId } });
    expect(res2.status()).toBe(409);
    expect((await res2.json()).error).toContain('sudah selesai');

    // Cleanup jadwal force submit
    await request.delete(`/api/jadwal/${fsJadwalId}`);
  });

  test('Force submit tanpa sessionId → 400', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.post('/api/monitoring', { data: {} });
    expect(res.status()).toBe(400);
  });

  test('Force submit session tidak ada → 404', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.post('/api/monitoring', {
      data: { sessionId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status()).toBe(404);
  });

  test('Siswa tidak bisa force submit → 403', async ({ request }) => {
    // Buat session baru untuk test ini
    await loginAsSiswa(request);
    const me     = await (await request.get('/api/auth/me')).json();
    const sId    = me.siswa?.id;

    await loginAsProktor(request);
    const j = await (await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 60, status_publikasi: 'Published', siswa_ids: [sId] },
    })).json();

    await loginAsSiswa(request);
    const sess = await (await request.post('/api/session', { data: { siswaId: sId, jadwalId: j.id } })).json();

    // Siswa coba force submit
    const res = await request.post('/api/monitoring', { data: { sessionId: sess.id } });
    expect(res.status()).toBe(403);

    // Cleanup
    await loginAsProktor(request);
    await request.delete(`/api/jadwal/${j.id}`);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.post('/api/monitoring', { data: { sessionId } });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 4. Teardown ───────────────────────────────────────────────────────────────
test.describe('Teardown monitoring', () => {
  test('Hapus semua jadwal dan ujian', async ({ request }) => {
    await loginAsProktor(request);
    if (jadwalId) await request.delete(`/api/jadwal/${jadwalId}`);
    // fsJadwalId dideklarasikan di describe block force submit, hapus via DB jika perlu
    await loginAsGuru(request);
    if (ujianId) await request.delete(`/api/ujian/${ujianId}`);
  });
});
