import { test, expect, type APIRequestContext } from '@playwright/test';

// ── Helper: login via API dan simpan cookie di request context ────────────────
async function loginAs(request: APIRequestContext, username: string, password: string) {
  const res = await request.post('/api/auth/login', {
    data: { username, password },
  });
  expect(res.status()).toBe(200);
  return res;
}

// ── 1. Middleware: akses halaman role lain → redirect ke dashboard sendiri ─────
test.describe('Middleware — cross-role page access redirect', () => {
  test('siswa mengakses /guru/dashboard → redirect ke /siswa/dashboard', async ({ page }) => {
    // Login sebagai siswa dulu
    await page.goto('/login');
    await page.locator('#login-username').fill('240006');
    await page.locator('#login-password').fill('240006@umbk');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL('**/siswa/dashboard', { timeout: 10_000 });

    // Coba paksa akses halaman guru
    await page.goto('/guru/dashboard');
    await page.waitForURL('**/siswa/dashboard', { timeout: 8_000 });
    await expect(page).toHaveURL(/siswa\/dashboard/);
  });

  test('siswa mengakses /proktor/dashboard → redirect ke /siswa/dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-username').fill('240007');
    await page.locator('#login-password').fill('240007@umbk');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL('**/siswa/dashboard', { timeout: 10_000 });

    await page.goto('/proktor/dashboard');
    await page.waitForURL('**/siswa/dashboard', { timeout: 8_000 });
    await expect(page).toHaveURL(/siswa\/dashboard/);
  });

  test('guru mengakses /siswa/dashboard → redirect ke /guru/dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-username').fill('102008');
    await page.locator('#login-password').fill('102008@umbk');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL('**/guru/dashboard', { timeout: 10_000 });

    await page.goto('/siswa/dashboard');
    await page.waitForURL('**/guru/dashboard', { timeout: 8_000 });
    await expect(page).toHaveURL(/guru\/dashboard/);
  });

  test('guru mengakses /proktor/dashboard → redirect ke /guru/dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-username').fill('111009');
    await page.locator('#login-password').fill('111009@umbk');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL('**/guru/dashboard', { timeout: 10_000 });

    await page.goto('/proktor/dashboard');
    await page.waitForURL('**/guru/dashboard', { timeout: 8_000 });
    await expect(page).toHaveURL(/guru\/dashboard/);
  });

  test('proktor mengakses /guru/dashboard → redirect ke /proktor/dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-username').fill('proktor1');
    await page.locator('#login-password').fill('ecbtmtswaha');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL('**/proktor/dashboard', { timeout: 10_000 });

    await page.goto('/guru/dashboard');
    await page.waitForURL('**/proktor/dashboard', { timeout: 8_000 });
    await expect(page).toHaveURL(/proktor\/dashboard/);
  });

  test('proktor mengakses /siswa/dashboard → redirect ke /proktor/dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.locator('#login-username').fill('proktor1');
    await page.locator('#login-password').fill('ecbtmtswaha');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await page.waitForURL('**/proktor/dashboard', { timeout: 10_000 });

    await page.goto('/siswa/dashboard');
    await page.waitForURL('**/proktor/dashboard', { timeout: 8_000 });
    await expect(page).toHaveURL(/proktor\/dashboard/);
  });
});

// ── 2. API Authorization — endpoint yang butuh auth tanpa cookie ──────────────
test.describe('API Authorization — tanpa auth → 401', () => {
  const protectedEndpoints = [
    { method: 'GET',  url: '/api/ujian' },
    { method: 'GET',  url: '/api/jadwal' },
    { method: 'GET',  url: '/api/soal/nonexistent-id' },
    { method: 'GET',  url: '/api/session?siswaId=x&jadwalId=y' },
    { method: 'GET',  url: '/api/jawaban?sessionId=x' },
    { method: 'GET',  url: '/api/akun' },
    { method: 'GET',  url: '/api/auth/me' },
  ];

  for (const ep of protectedEndpoints) {
    test(`${ep.method} ${ep.url} tanpa auth → 401`, async ({ request }) => {
      // Buat request context baru tanpa cookie (fresh context)
      const res = ep.method === 'GET'
        ? await request.get(ep.url)
        : await request.post(ep.url, { data: {} });
      expect(res.status()).toBe(401);
    });
  }
});

// ── 3. API Authorization — siswa tidak boleh POST /api/ujian ─────────────────
test('API Auth — siswa POST /api/ujian → 403', async ({ request }) => {
  await loginAs(request, '240006', '240006@umbk');
  const res = await request.post('/api/ujian', {
    data: { nama_ujian: 'Test', jenis_ujian: 'LATIHAN', durasi: 90 },
  });
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toBe('Forbidden.');
});

// ── 4. API Authorization — siswa tidak boleh POST /api/jadwal ────────────────
test('API Auth — siswa POST /api/jadwal → 403', async ({ request }) => {
  await loginAs(request, '240007', '240007@umbk');
  const res = await request.post('/api/jadwal', {
    data: { id_ujian: 'x', durasi_menit: 90 },
  });
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toBe('Forbidden.');
});

// ── 5. API Authorization — guru tidak boleh POST /api/jadwal ─────────────────
test('API Auth — guru POST /api/jadwal → 403', async ({ request }) => {
  await loginAs(request, '102008', '102008@umbk');
  const res = await request.post('/api/jadwal', {
    data: { id_ujian: 'x', durasi_menit: 90 },
  });
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toBe('Forbidden.');
});

// ── 6. API Authorization — siswa tidak boleh POST /api/soal/[id] ─────────────
test('API Auth — siswa POST /api/soal/[id] → 403', async ({ request }) => {
  await loginAs(request, '240008', '240008@umbk');
  const res = await request.post('/api/soal/nonexistent-ujian-id', {
    data: { soals: [] },
  });
  expect(res.status()).toBe(403);
  const body = await res.json();
  expect(body.error).toBe('Forbidden.');
});

// ── 7. API Authorization — proktor boleh GET /api/jadwal ─────────────────────
test('API Auth — proktor GET /api/jadwal → 200', async ({ request }) => {
  await loginAs(request, 'proktor1', 'ecbtmtswaha');
  const res = await request.get('/api/jadwal');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

// ── 8. API Authorization — guru boleh GET /api/ujian ─────────────────────────
test('API Auth — guru GET /api/ujian → 200', async ({ request }) => {
  await loginAs(request, '102008', '102008@umbk');
  const res = await request.get('/api/ujian');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

// ── 9. API Authorization — siswa boleh GET /api/ujian ────────────────────────
test('API Auth — siswa GET /api/ujian → 200', async ({ request }) => {
  await loginAs(request, '240006', '240006@umbk');
  const res = await request.get('/api/ujian');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

// ── 10. Guru tidak boleh edit soal ujian guru lain → 403 ─────────────────────
test('API Auth — guru edit soal ujian guru lain → 403', async ({ request }) => {
  // Login sebagai guru1 dan buat ujian
  await loginAs(request, '102008', '102008@umbk');
  const createRes = await request.post('/api/ujian', {
    data: { nama_ujian: 'Ujian Auth Test', jenis_ujian: 'LATIHAN', durasi: 90 },
  });
  expect(createRes.status()).toBe(201);
  const ujian = await createRes.json();
  const ujianId = ujian.id;

  // Login sebagai guru2 — coba edit soal ujian guru1
  await loginAs(request, '111009', '111009@umbk');
  const editRes = await request.post(`/api/soal/${ujianId}`, {
    data: {
      soals: [{
        nomor: 1, pertanyaan: 'Hack', opsi_a: 'A', opsi_b: 'B', opsi_c: 'C', opsi_d: 'D',
        jawaban_benar: 'A', bobot: 1,
      }],
    },
  });
  expect(editRes.status()).toBe(403);
  const body = await editRes.json();
  expect(body.error).toBe('Forbidden.');

  // Cleanup — login kembali sebagai guru1 dan hapus ujian
  await loginAs(request, '102008', '102008@umbk');
  await request.delete(`/api/ujian/${ujianId}`);
});
