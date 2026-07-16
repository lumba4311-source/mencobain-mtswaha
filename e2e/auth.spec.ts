import { test, expect } from '@playwright/test';

// ── Semua kredensial dari seed-pg.sql ────────────────────────────────────────
const ALL_USERS = [
  { username: 'proktor1', password: 'ecbtmtswaha', role: 'proktor', redirectTo: '/proktor/dashboard' },
  { username: '102008',   password: '102008@umbk',  role: 'guru',    redirectTo: '/guru/dashboard' },
  { username: '111009',   password: '111009@umbk',  role: 'guru',    redirectTo: '/guru/dashboard' },
  { username: '12003',    password: '12003@umbk',   role: 'guru',    redirectTo: '/guru/dashboard' },
  { username: '240006',   password: '240006@umbk',  role: 'siswa',   redirectTo: '/siswa/dashboard' },
  { username: '240007',   password: '240007@umbk',  role: 'siswa',   redirectTo: '/siswa/dashboard' },
  { username: '240008',   password: '240008@umbk',  role: 'siswa',   redirectTo: '/siswa/dashboard' },
];

// Helper: login via UI dan tunggu redirect
async function loginUI(page: any, username: string, password: string) {
  await page.goto('/login');
  await page.locator('#login-username').fill(username);
  await page.locator('#login-password').fill(password);
  await page.getByRole('button', { name: 'Masuk' }).click();
}

// Helper: login via API (lebih cepat untuk setup state)
async function loginAPI(request: any, username: string, password: string) {
  const res = await request.post('/api/auth/login', {
    data: { username, password },
  });
  return res;
}

// ── 1. Login semua user valid ─────────────────────────────────────────────────
test.describe('Auth — Login semua akun seed valid', () => {
  for (const u of ALL_USERS) {
    test(`${u.role} ${u.username} berhasil login dan redirect ke ${u.redirectTo}`, async ({ page }) => {
      await loginUI(page, u.username, u.password);
      await page.waitForURL(`**${u.redirectTo}`, { timeout: 10_000 });
      await expect(page).toHaveURL(new RegExp(u.redirectTo));
    });
  }
});

// ── 2. Login via API — semua user valid ──────────────────────────────────────
test.describe('Auth API — POST /api/auth/login semua akun seed', () => {
  for (const u of ALL_USERS) {
    test(`${u.role} ${u.username} → 200 + cookie`, async ({ request }) => {
      const res = await loginAPI(request, u.username, u.password);
      expect(res.status()).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty('user');
      expect(body.user.username).toBe(u.username);
      expect(body.user.role).toBe(u.role);
      // Cookie harus di-set (header set-cookie ada)
      const headers = res.headers();
      expect(headers['set-cookie']).toMatch(/umbk-access-token/);
    });
  }
});

// ── 3. Password salah untuk setiap role ──────────────────────────────────────
test.describe('Auth API — Password salah', () => {
  const wrongCases = [
    { username: 'proktor1', password: 'salah', role: 'proktor' },
    { username: '102008',   password: 'salah', role: 'guru' },
    { username: '240006',   password: 'salah', role: 'siswa' },
  ];

  for (const c of wrongCases) {
    test(`${c.role} ${c.username} dengan password salah → 401`, async ({ request }) => {
      const res = await loginAPI(request, c.username, c.password);
      expect(res.status()).toBe(401);
      const body = await res.json();
      expect(body.error).toBe('Username atau password salah.');
    });
  }
});

// ── 4. Username tidak ada ────────────────────────────────────────────────────
test('Auth API — username tidak terdaftar → 401', async ({ request }) => {
  const res = await loginAPI(request, 'tidakada999', 'apapun');
  expect(res.status()).toBe(401);
  const body = await res.json();
  expect(body.error).toBe('Username atau password salah.');
});

// ── 5. Body kosong / field kosong ────────────────────────────────────────────
test('Auth API — body kosong → 400', async ({ request }) => {
  const res = await request.post('/api/auth/login', { data: {} });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body.error).toBe('Username dan password wajib diisi.');
});

test('Auth API — username kosong → 400', async ({ request }) => {
  const res = await request.post('/api/auth/login', { data: { username: '', password: 'ecbtmtswaha' } });
  expect(res.status()).toBe(400);
});

test('Auth API — password kosong → 400', async ({ request }) => {
  const res = await request.post('/api/auth/login', { data: { username: 'proktor1', password: '' } });
  expect(res.status()).toBe(400);
});

// ── 6. Logout ─────────────────────────────────────────────────────────────────
test('Auth API — logout menghapus cookie', async ({ request }) => {
  // Login dulu
  await loginAPI(request, 'proktor1', 'ecbtmtswaha');
  // Logout
  const res = await request.post('/api/auth/logout');
  expect(res.status()).toBe(200);
  // Cookie harus di-clear (max-age=0 atau expires di masa lalu)
  const headers = res.headers();
  const cookie = headers['set-cookie'] ?? '';
  // Cookie umbk-access-token di-clear
  expect(cookie).toMatch(/umbk-access-token/);
  expect(cookie).toMatch(/max-age=0|expires=.*1970/i);
});

// ── 7. /api/auth/me — tanpa cookie → 401 ────────────────────────────────────
test('Auth API — /api/auth/me tanpa cookie → 401', async ({ request }) => {
  const res = await request.get('/api/auth/me');
  expect(res.status()).toBe(401);
});

// ── 8. /api/auth/me — dengan cookie valid ────────────────────────────────────
test('Auth API — /api/auth/me dengan cookie valid mengembalikan user', async ({ request }) => {
  await loginAPI(request, '102008', '102008@umbk');
  const res = await request.get('/api/auth/me');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty('user');
  expect(body.user.username).toBe('102008');
  expect(body.user.role).toBe('guru');
});

// ── 9. Middleware redirect — user sudah login tidak bisa ke /login ────────────
test('Middleware — user sudah login diredirect dari /login ke dashboard', async ({ page }) => {
  // Login dulu via UI
  await loginUI(page, '240006', '240006@umbk');
  await page.waitForURL('**/siswa/dashboard', { timeout: 10_000 });

  // Coba akses /login lagi — harus diredirect
  await page.goto('/login');
  await page.waitForURL('**/siswa/dashboard', { timeout: 8_000 });
  await expect(page).toHaveURL(/siswa\/dashboard/);
});

// ── 10. Middleware — akses halaman protected tanpa login → redirect /login ────
test.describe('Middleware — halaman protected tanpa auth redirect ke /login', () => {
  const protectedRoutes = [
    '/proktor/dashboard',
    '/guru/dashboard',
    '/siswa/dashboard',
  ];

  for (const route of protectedRoutes) {
    test(`${route} tanpa login → redirect ke /login`, async ({ page }) => {
      await page.goto(route);
      await page.waitForURL('**/login', { timeout: 8_000 });
      await expect(page).toHaveURL(/\/login/);
    });
  }
});
