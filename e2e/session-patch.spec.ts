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
];

let ujianId   = '';
let jadwalId  = '';
let siswaId   = '';
let sessionId = '';

// ── 1. Setup ──────────────────────────────────────────────────────────────────
test.describe('Setup session PATCH', () => {
  test('Buat ujian, jadwal, dan session untuk test PATCH', async ({ request }) => {
    await loginAsGuru(request);
    const u = await (await request.post('/api/ujian', {
      data: { nama_ujian: 'Session PATCH Test', jenis_ujian: 'LATIHAN', durasi: 60 },
    })).json();
    ujianId = u.id;
    await request.post(`/api/soal/${ujianId}`, { data: { soals: SOALS } });

    await loginAsSiswa(request);
    const me = await (await request.get('/api/auth/me')).json();
    siswaId  = me.siswa?.id;
    expect(siswaId).toBeTruthy();

    await loginAsProktor(request);
    const j = await (await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 60, status_publikasi: 'Published', siswa_ids: [siswaId] },
    })).json();
    jadwalId = j.id;

    await loginAsSiswa(request);
    const sess = await (await request.post('/api/session', { data: { siswaId, jadwalId } })).json();
    sessionId = sess.id;
    expect(sessionId).toBeTruthy();
  });
});

// ── 2. PATCH /api/session — update sisa_waktu ─────────────────────────────────
test.describe('PATCH /api/session — sisa_waktu', () => {
  test('Siswa bisa update sisa_waktu miliknya → ok:true', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.patch('/api/session', {
      data: { sessionId, sisa_waktu: 3000 },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('Proktor bisa update sisa_waktu session siswa → ok:true', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.patch('/api/session', {
      data: { sessionId, sisa_waktu: 2500 },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('Tanpa sessionId → 400', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.patch('/api/session', { data: { sisa_waktu: 100 } });
    expect(res.status()).toBe(400);
  });

  test('sessionId tidak ditemukan → 404', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.patch('/api/session', {
      data: { sessionId: '00000000-0000-0000-0000-000000000000', sisa_waktu: 100 },
    });
    expect(res.status()).toBe(404);
  });
});

// ── 3. PATCH /api/session — update status ────────────────────────────────────
test.describe('PATCH /api/session — status', () => {
  test('Siswa bisa update status ke selesai', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.patch('/api/session', {
      data: { sessionId, status: 'selesai' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('Siswa tidak bisa set status force_submit → 400', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.patch('/api/session', {
      data: { sessionId, status: 'force_submit' },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('Status tidak valid');
  });

  test('Proktor bisa set status force_submit', async ({ request }) => {
    // Reset session ke berlangsung dulu via DB
    // Buat session baru
    await loginAsProktor(request);
    const me2 = await loginAsSiswa(request).then(() =>
      request.get('/api/auth/me').then(r => r.json())
    );
    const sid2 = me2.siswa?.id;

    await loginAsProktor(request);
    const j2 = await (await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 60, status_publikasi: 'Published', siswa_ids: [sid2] },
    })).json();

    await loginAsSiswa(request);
    const sess2 = await (await request.post('/api/session', {
      data: { siswaId: sid2, jadwalId: j2.id },
    })).json();

    // Proktor set force_submit
    await loginAsProktor(request);
    const res = await request.patch('/api/session', {
      data: { sessionId: sess2.id, status: 'force_submit' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);

    // Cleanup
    await request.delete(`/api/jadwal/${j2.id}`);
  });

  test('Siswa lain tidak bisa update session orang lain → 403', async ({ request }) => {
    await loginAsSiswa2(request);
    const res = await request.patch('/api/session', {
      data: { sessionId, sisa_waktu: 100 },
    });
    expect(res.status()).toBe(403);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.patch('/api/session', {
      data: { sessionId, sisa_waktu: 100 },
    });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test('Tidak ada field yang di-update → ok:true (no-op)', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.patch('/api/session', { data: { sessionId } });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});

// ── 4. Teardown ───────────────────────────────────────────────────────────────
test.describe('Teardown session PATCH', () => {
  test('Hapus jadwal dan ujian', async ({ request }) => {
    await loginAsProktor(request);
    if (jadwalId) await request.delete(`/api/jadwal/${jadwalId}`);
    await loginAsGuru(request);
    if (ujianId) await request.delete(`/api/ujian/${ujianId}`);
  });
});
