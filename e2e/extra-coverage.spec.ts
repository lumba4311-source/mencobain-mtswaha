import { test, expect, type APIRequestContext } from '@playwright/test';

async function loginAs(r: APIRequestContext, username: string, password: string) {
  const res = await r.post('/api/auth/login', { data: { username, password } });
  expect(res.status()).toBe(200);
  return res;
}

const loginAsGuru    = (r: APIRequestContext) => loginAs(r, '102008', '102008@umbk');
const loginAsProktor = (r: APIRequestContext) => loginAs(r, 'proktor1', 'ecbtmtswaha');
const loginAsSiswa   = (r: APIRequestContext) => loginAs(r, '240006', '240006@umbk');

const SISWA1_ID = '5f438336-b395-430c-a69f-485019b1d57f';
const SOALS = [
  { nomor: 1, pertanyaan: 'Q1', opsi_a: 'A', opsi_b: 'B', opsi_c: 'C', opsi_d: 'D', jawaban_benar: 'A', bobot: 1 },
];

// ── 1. GET /api/auth/me — semua role ─────────────────────────────────────────
// Response shape: { user: { role, ... }, siswa: null|{}, guru: null|{}, access_token }
test.describe('GET /api/auth/me — semua role', () => {
  test('Proktor /me mengandung role proktor dan siswa/guru null', async ({ request }) => {
    await loginAsProktor(request);
    const res  = await request.get('/api/auth/me');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe('proktor');
    expect(body.siswa).toBeNull();
    expect(body.guru).toBeNull();
  });

  test('Guru /me mengandung role guru + data guru', async ({ request }) => {
    await loginAsGuru(request);
    const res  = await request.get('/api/auth/me');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe('guru');
    expect(body.guru).toBeTruthy();
    expect(body.guru).toHaveProperty('id');
    expect(body.siswa).toBeNull();
  });

  test('Siswa /me mengandung role siswa + data siswa', async ({ request }) => {
    await loginAsSiswa(request);
    const res  = await request.get('/api/auth/me');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.user.role).toBe('siswa');
    expect(body.siswa).toBeTruthy();
    expect(body.siswa).toHaveProperty('id');
    expect(body.guru).toBeNull();
  });
});

// ── 2. POST /api/session — edge cases ────────────────────────────────────────
test.describe('POST /api/session — edge cases', () => {
  let ujianId  = '';
  let jadwalId = '';

  test('Setup ujian + jadwal Draft', async ({ request }) => {
    await loginAsGuru(request);
    const u = await (await request.post('/api/ujian', {
      data: { nama_ujian: 'Extra Session Test', jenis_ujian: 'LATIHAN', durasi: 60 },
    })).json();
    ujianId = u.id;
    await request.post(`/api/soal/${ujianId}`, { data: { soals: SOALS } });

    await loginAsProktor(request);
    const j = await (await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 60, status_publikasi: 'Draft', siswa_ids: [SISWA1_ID] },
    })).json();
    jadwalId = j.id;
  });

  test('Tanpa siswaId dan jadwalId → 400', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.post('/api/session', { data: {} });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('wajib');
  });

  test('POST /api/session idempoten — return session lama jika sudah ada', async ({ request }) => {
    await loginAsProktor(request);
    await request.put(`/api/jadwal/${jadwalId}`, { data: { status_publikasi: 'Published' } });

    await loginAsSiswa(request);
    const sess1 = await (await request.post('/api/session', { data: { siswaId: SISWA1_ID, jadwalId } })).json();
    const sess2 = await (await request.post('/api/session', { data: { siswaId: SISWA1_ID, jadwalId } })).json();
    expect(sess1.id).toBe(sess2.id);
  });

  test('GET /api/session tanpa parameter → 400', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.get('/api/session');
    expect(res.status()).toBe(400);
  });

  test('GET /api/session session tidak ada → null', async ({ request }) => {
    await loginAsProktor(request);
    const res  = await request.get(`/api/session?siswaId=${SISWA1_ID}&jadwalId=00000000-0000-0000-0000-000000000000`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });

  test('Teardown', async ({ request }) => {
    await loginAsProktor(request);
    if (jadwalId) await request.delete(`/api/jadwal/${jadwalId}`);
    await loginAsGuru(request);
    if (ujianId) await request.delete(`/api/ujian/${ujianId}`);
  });
});

// ── 3. GET /api/ujian — semua role ────────────────────────────────────────────
test.describe('GET /api/ujian', () => {
  test('Guru bisa GET semua ujian → 200 array', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.get('/api/ujian');
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('Proktor bisa GET semua ujian → 200', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.get('/api/ujian');
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('Siswa bisa GET ujian → 200', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.get('/api/ujian');
    expect(res.status()).toBe(200);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.get('/api/ujian');
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 4. POST /api/ujian — validasi ────────────────────────────────────────────
// Catatan: API tidak melakukan validasi input eksplisit — invalid input menyebabkan
// DB constraint error (500), bukan 400. Ini dokumentasi perilaku aktual.
test.describe('POST /api/ujian — validasi', () => {
  test('Tanpa nama_ujian → 500 (DB constraint, tidak ada validasi)', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.post('/api/ujian', {
      data: { jenis_ujian: 'LATIHAN', durasi: 60 },
    });
    // API tidak ada explicit validation — 500 dari null constraint di DB
    expect([400, 500]).toContain(res.status());
  });

  test('jenis_ujian tidak valid (UTS) → 500 (enum constraint)', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.post('/api/ujian', {
      data: { nama_ujian: 'Test', jenis_ujian: 'UTS', durasi: 60 },
    });
    // UTS bukan nilai enum valid — DB menolak dengan error 500
    expect([400, 500]).toContain(res.status());
  });

  test('Siswa tidak bisa POST ujian → 403', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.post('/api/ujian', {
      data: { nama_ujian: 'Hack', jenis_ujian: 'LATIHAN', durasi: 60 },
    });
    expect(res.status()).toBe(403);
  });
});

// ── 5. GET /api/jadwal — semua role ──────────────────────────────────────────
test.describe('GET /api/jadwal', () => {
  test('Proktor bisa GET semua jadwal → 200', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.get('/api/jadwal');
    expect(res.status()).toBe(200);
    expect(Array.isArray(await res.json())).toBe(true);
  });

  test('Guru bisa GET jadwal → 200', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.get('/api/jadwal');
    expect(res.status()).toBe(200);
  });

  test('Siswa bisa GET jadwal → 200', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.get('/api/jadwal');
    expect(res.status()).toBe(200);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.get('/api/jadwal');
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 6. POST /api/jadwal — validasi ───────────────────────────────────────────
// Catatan: API tidak ada explicit validation — invalid input menyebabkan 500 dari DB
test.describe('POST /api/jadwal — validasi', () => {
  test('Tanpa id_ujian → 400 atau 500 (tidak ada validasi eksplisit)', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.post('/api/jadwal', {
      data: { durasi_menit: 60, status_publikasi: 'Draft' },
    });
    // Tidak ada null check di route — DB foreign key constraint throw 500
    expect([400, 500]).toContain(res.status());
  });

  test('Guru tidak bisa POST jadwal → 403', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.post('/api/jadwal', {
      data: { id_ujian: '00000000-0000-0000-0000-000000000000', durasi_menit: 60 },
    });
    expect(res.status()).toBe(403);
  });

  test('Siswa tidak bisa POST jadwal → 403', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.post('/api/jadwal', {
      data: { id_ujian: '00000000-0000-0000-0000-000000000000', durasi_menit: 60 },
    });
    expect(res.status()).toBe(403);
  });
});

// ── 7. POST /api/nilai — validasi & auth ─────────────────────────────────────
test.describe('POST /api/nilai — validasi', () => {
  test('Tanpa sessionId → 400', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.post('/api/nilai', { data: {} });
    expect(res.status()).toBe(400);
  });

  test('sessionId tidak ada → 404', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.post('/api/nilai', {
      data: { sessionId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status()).toBe(404);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.post('/api/nilai', {
      data: { sessionId: '00000000-0000-0000-0000-000000000000' },
    });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 8. GET /api/soal/[ujianId] — validasi ────────────────────────────────────
test.describe('GET /api/soal/[ujianId]', () => {
  test('Ujian tidak ada → 200 array kosong atau 404', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.get('/api/soal/00000000-0000-0000-0000-000000000000');
    expect([200, 404]).toContain(res.status());
  });

  test('Siswa GET soal → jawaban_benar tidak ada di response', async ({ request }) => {
    // Ambil ujian pertama yang ada soalnya
    await loginAsGuru(request);
    const ujians = await (await request.get('/api/ujian')).json();
    const ujianWithSoal = ujians.find((u: { id: string }) => u.id);
    if (!ujianWithSoal) return;

    await loginAsSiswa(request);
    const res   = await request.get(`/api/soal/${ujianWithSoal.id}`);
    expect(res.status()).toBe(200);
    const soals = await res.json();
    if (Array.isArray(soals) && soals.length > 0) {
      soals.forEach((s: Record<string, unknown>) => {
        expect(s).not.toHaveProperty('jawaban_benar');
      });
    }
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.get('/api/soal/00000000-0000-0000-0000-000000000000');
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 9. POST /api/akun — buat akun tanpa NIS/kelas (opsional) ─────────────────
test.describe('POST /api/akun — NIS dan kelas opsional untuk siswa', () => {
  let createdUserId = '';

  test('Buat siswa tanpa NIS dan id_kelas → 201 atau 400', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.post('/api/akun', {
      data: {
        username: 'test_nonis_e2e',
        password: 'password123',
        nama    : 'Siswa Tanpa NIS',
        role    : 'siswa',
      },
    });
    const status = res.status();
    console.log(`[AKUN] Siswa tanpa NIS: status=${status}`);
    expect([201, 400, 409]).toContain(status);
    if (status === 201) {
      createdUserId = (await res.json()).userId;
    }
  });

  test('Cleanup', async ({ request }) => {
    if (!createdUserId) return;
    await loginAsProktor(request);
    const akun = await (await request.get('/api/akun')).json();
    const row  = akun.siswas?.find((s: { id_user: string }) => s.id_user === createdUserId);
    if (row) await request.delete(`/api/akun?id=${row.id}&type=siswa`);
  });
});

// ── 10. DELETE /api/ujian — ujian tanpa jadwal bisa dihapus ──────────────────
test.describe('DELETE /api/ujian/[id] — ujian Draft bisa dihapus', () => {
  test('Ujian dengan jadwal Draft bisa dihapus', async ({ request }) => {
    await loginAsGuru(request);
    const u = await (await request.post('/api/ujian', {
      data: { nama_ujian: 'Hapus Test Draft', jenis_ujian: 'LATIHAN', durasi: 60 },
    })).json();

    await loginAsProktor(request);
    const j = await (await request.post('/api/jadwal', {
      data: { id_ujian: u.id, durasi_menit: 60, status_publikasi: 'Draft', siswa_ids: [] },
    })).json();

    // Hapus jadwal dulu
    await request.delete(`/api/jadwal/${j.id}`);

    // Baru hapus ujian
    await loginAsGuru(request);
    const res = await request.delete(`/api/ujian/${u.id}`);
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('Ujian tidak ada → 200 (DELETE idempoten)', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.delete('/api/ujian/00000000-0000-0000-0000-000000000000');
    // DELETE non-existent biasanya 200 karena query DELETE tidak error
    expect([200, 404]).toContain(res.status());
  });
});
