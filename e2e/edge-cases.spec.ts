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

const NULL_UUID = '00000000-0000-0000-0000-000000000000';
const SOALS = [
  { nomor: 1, pertanyaan: 'Q1', opsi_a: 'A', opsi_b: 'B', opsi_c: 'C', opsi_d: 'D', jawaban_benar: 'A', bobot: 1 },
  { nomor: 2, pertanyaan: 'Q2', opsi_a: 'A', opsi_b: 'B', opsi_c: 'C', opsi_d: 'D', jawaban_benar: 'B', bobot: 1 },
];

let ujianId  = '';
let jadwalId = '';
let siswaId  = '';
let sessionId = '';

// ── 1. Setup shared fixtures ──────────────────────────────────────────────────
test.describe('Setup edge-cases fixtures', () => {
  test('Buat ujian + jadwal + session', async ({ request }) => {
    await loginAsGuru(request);
    const u = await (await request.post('/api/ujian', {
      data: { nama_ujian: 'Edge Cases Test', jenis_ujian: 'LATIHAN', durasi: 60 },
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

// ── 2. GET /api/ujian/[id] ────────────────────────────────────────────────────
test.describe('GET /api/ujian/[id]', () => {
  test('Semua role terautentikasi bisa GET ujian by id → 200', async ({ request }) => {
    await loginAsGuru(request);
    const res  = await request.get(`/api/ujian/${ujianId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(ujianId);
    expect(body).toHaveProperty('kelas_ids');
  });

  test('Siswa bisa GET ujian by id → 200', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.get(`/api/ujian/${ujianId}`);
    expect(res.status()).toBe(200);
  });

  test('Ujian tidak ditemukan → 404', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.get(`/api/ujian/${NULL_UUID}`);
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toContain('tidak ditemukan');
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.get(`/api/ujian/${ujianId}`);
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 3. PUT /api/ujian/[id] ────────────────────────────────────────────────────
test.describe('PUT /api/ujian/[id]', () => {
  test('Guru bisa update nama_ujian → ok:true', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.put(`/api/ujian/${ujianId}`, {
      data: { nama_ujian: 'Edge Cases Test Updated' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('Proktor bisa update ujian → ok:true', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.put(`/api/ujian/${ujianId}`, {
      data: { nama_ujian: 'Edge Cases Test Updated v2' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('Guru bisa update kelas_ids → ok:true', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.put(`/api/ujian/${ujianId}`, {
      data: { kelas_ids: ['00000000-0000-0000-0000-000000000101'] },
    });
    expect(res.status()).toBe(200);
  });

  test('Siswa tidak bisa PUT ujian → 403', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.put(`/api/ujian/${ujianId}`, { data: { nama_ujian: 'Hacked' } });
    expect(res.status()).toBe(403);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.put(`/api/ujian/${ujianId}`, { data: { nama_ujian: 'x' } });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 4. DELETE /api/ujian/[id] — jadwal aktif ─────────────────────────────────
test.describe('DELETE /api/ujian/[id] — proteksi jadwal aktif', () => {
  test('Tidak bisa hapus ujian yang punya jadwal Published → 409', async ({ request }) => {
    await loginAsGuru(request);
    const res  = await request.delete(`/api/ujian/${ujianId}`);
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toContain('jadwal aktif');
  });
});

// ── 5. GET /api/jadwal/[id] ───────────────────────────────────────────────────
test.describe('GET /api/jadwal/[id]', () => {
  test('Semua role terautentikasi bisa GET jadwal by id → 200', async ({ request }) => {
    await loginAsSiswa(request);
    const res  = await request.get(`/api/jadwal/${jadwalId}`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(jadwalId);
    expect(body).toHaveProperty('ujians');
    expect(body).toHaveProperty('siswa_ids');
  });

  test('Jadwal tidak ditemukan → 404', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.get(`/api/jadwal/${NULL_UUID}`);
    expect(res.status()).toBe(404);
    expect((await res.json()).error).toContain('tidak ditemukan');
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.get(`/api/jadwal/${jadwalId}`);
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 6. PUT /api/jadwal/[id] ───────────────────────────────────────────────────
test.describe('PUT /api/jadwal/[id]', () => {
  test('Proktor bisa update status_publikasi jadwal → ok:true', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.put(`/api/jadwal/${jadwalId}`, {
      data: { status_publikasi: 'Draft' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);

    // Kembalikan ke Published
    await request.put(`/api/jadwal/${jadwalId}`, { data: { status_publikasi: 'Published' } });
  });

  test('Proktor bisa update siswa_ids jadwal', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.put(`/api/jadwal/${jadwalId}`, {
      data: { siswa_ids: [siswaId] },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('Guru tidak bisa PUT jadwal → 403', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.put(`/api/jadwal/${jadwalId}`, { data: { status_publikasi: 'Draft' } });
    expect(res.status()).toBe(403);
  });

  test('Siswa tidak bisa PUT jadwal → 403', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.put(`/api/jadwal/${jadwalId}`, { data: { status_publikasi: 'Draft' } });
    expect(res.status()).toBe(403);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.put(`/api/jadwal/${jadwalId}`, { data: { status_publikasi: 'Draft' } });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 7. GET /api/jawaban — security gap (no role check) ───────────────────────
test.describe('GET /api/jawaban — security gap', () => {
  test('Siswa bisa GET jawaban session miliknya', async ({ request }) => {
    await loginAsSiswa(request);
    const res  = await request.get(`/api/jawaban?sessionId=${sessionId}`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('Guru bisa GET jawaban (tidak ada role check → 200)', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.get(`/api/jawaban?sessionId=${sessionId}`);
    expect(res.status()).toBe(200);
  });

  test('Siswa lain bisa GET jawaban session orang lain (no ownership check)', async ({ request }) => {
    await loginAsSiswa2(request);
    const res = await request.get(`/api/jawaban?sessionId=${sessionId}`);
    // API tidak ada ownership check untuk GET jawaban
    expect(res.status()).toBe(200);
  });

  test('Tanpa sessionId → 400', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.get('/api/jawaban');
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('sessionId wajib');
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.get(`/api/jawaban?sessionId=${sessionId}`);
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 8. POST /api/jawaban — upsert ────────────────────────────────────────────
test.describe('POST /api/jawaban — upsert', () => {
  let soalId = '';

  test('Ambil soalId pertama dari ujian', async ({ request }) => {
    await loginAsGuru(request);
    const soals = await (await request.get(`/api/soal/${ujianId}`)).json();
    soalId = soals[0]?.id;
    expect(soalId).toBeTruthy();
  });

  test('Siswa bisa POST jawaban → ok:true', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.post('/api/jawaban', {
      data: { sessionId, soalId, jawaban_siswa: 'A', status_soal: 'sudah' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('POST jawaban kedua kali (upsert) → ok:true', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.post('/api/jawaban', {
      data: { sessionId, soalId, jawaban_siswa: 'B', status_soal: 'sudah' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('Jawaban terakhir tersimpan benar', async ({ request }) => {
    await loginAsSiswa(request);
    const jawabans = await (await request.get(`/api/jawaban?sessionId=${sessionId}`)).json();
    const j = jawabans.find((x: { id_soal: string }) => x.id_soal === soalId);
    expect(j?.jawaban_siswa).toBe('B');
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.post('/api/jawaban', {
      data: { sessionId, soalId, jawaban_siswa: 'A' },
    });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 9. GET /api/nilai — validasi parameter ───────────────────────────────────
test.describe('GET /api/nilai — validasi parameter', () => {
  test('Tanpa parameter → 400', async ({ request }) => {
    await loginAsProktor(request);
    const res  = await request.get('/api/nilai');
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('Minimal satu parameter');
  });

  test('Siswa bisa GET nilai miliknya via siswaId', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.get(`/api/nilai?siswaId=${siswaId}`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('Siswa tidak bisa GET nilai siswa lain via siswaId → 403', async ({ request }) => {
    await loginAsSiswa2(request);
    const res = await request.get(`/api/nilai?siswaId=${siswaId}`);
    expect(res.status()).toBe(403);
  });

  test('Proktor bisa GET nilai via jadwalId', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.get(`/api/nilai?jadwalId=${jadwalId}`);
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.get(`/api/nilai?jadwalId=${jadwalId}`);
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 10. DELETE /api/jadwal/[id] — cascade delete ─────────────────────────────
test.describe('DELETE /api/jadwal/[id] — cascade delete', () => {
  test('Proktor bisa hapus jadwal beserta session dan jawaban → ok:true', async ({ request }) => {
    await loginAsProktor(request);

    // Buat jadwal baru khusus untuk dihapus
    const me = await loginAsSiswa(request).then(() => request.get('/api/auth/me').then(r => r.json()));
    const sid = me.siswa?.id;

    await loginAsProktor(request);
    const j = await (await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 30, status_publikasi: 'Draft', siswa_ids: [sid] },
    })).json();

    // Siswa buat session + isi jawaban
    await loginAsSiswa(request);
    const sess = await (await request.post('/api/session', { data: { siswaId: sid, jadwalId: j.id } })).json();
    const soals = await (await request.get(`/api/soal/${ujianId}`)).json();
    await request.post('/api/jawaban', {
      data: { sessionId: sess.id, soalId: soals[0]?.id, jawaban_siswa: 'A' },
    });

    // Proktor hapus jadwal
    await loginAsProktor(request);
    const res = await request.delete(`/api/jadwal/${j.id}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);

    // Verifikasi jadwal sudah hilang
    const check = await request.get(`/api/jadwal/${j.id}`);
    expect(check.status()).toBe(404);
  });

  test('Guru tidak bisa DELETE jadwal → 403', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.delete(`/api/jadwal/${jadwalId}`);
    expect(res.status()).toBe(403);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.delete(`/api/jadwal/${jadwalId}`);
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 11. Token tidak valid ─────────────────────────────────────────────────────
test.describe('Token tidak valid / expired', () => {
  test('Cookie token invalid → 401 di protected endpoint', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
      extraHTTPHeaders: { Cookie: 'umbk-access-token=invalid.token.here' },
    });
    const res = await ctx.get('/api/auth/me');
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test('Cookie token expired → 401', async ({ playwright }) => {
    // Token JWT expired (exp sudah lewat, dibuat manual)
    const expiredToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
      'eyJpZCI6InRlc3QiLCJyb2xlIjoic2lzd2EiLCJpYXQiOjE2MDAwMDAwMDAsImV4cCI6MTYwMDAwMDAwMX0.' +
      'invalidsignature';
    const ctx = await playwright.request.newContext({
      baseURL: 'http://localhost:3000',
      extraHTTPHeaders: { Cookie: `umbk-access-token=${expiredToken}` },
    });
    const res = await ctx.get('/api/auth/me');
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 12. Teardown ──────────────────────────────────────────────────────────────
test.describe('Teardown edge-cases', () => {
  test('Hapus jadwal dan ujian', async ({ request }) => {
    await loginAsProktor(request);
    if (jadwalId) await request.delete(`/api/jadwal/${jadwalId}`);
    await loginAsGuru(request);
    if (ujianId) await request.delete(`/api/ujian/${ujianId}`);
  });
});
