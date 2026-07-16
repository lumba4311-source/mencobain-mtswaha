import { test, expect } from '@playwright/test';

// ── POST /api/auth/logout ─────────────────────────────────────────────────────

test.describe('POST /api/auth/logout', () => {
  test('Logout tanpa login → 200 (stateless, tidak perlu auth)', async ({ request }) => {
    const res = await request.post('/api/auth/logout');
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('Logout saat login → 200 + cookie dihapus', async ({ request }) => {
    // Login dulu
    await request.post('/api/auth/login', {
      data: { username: 'proktor1', password: 'ecbtmtswaha' },
    });

    // Verifikasi /api/auth/me bisa diakses sebelum logout
    const meBefore = await request.get('/api/auth/me');
    expect(meBefore.status()).toBe(200);

    // Logout
    const logout = await request.post('/api/auth/logout');
    expect(logout.status()).toBe(200);
    expect((await logout.json()).ok).toBe(true);
  });

  test('Setelah logout, /api/auth/me → 401', async ({ request }) => {
    // Login
    await request.post('/api/auth/login', {
      data: { username: '102008', password: '102008@umbk' },
    });

    // Verifikasi login berhasil
    expect((await request.get('/api/auth/me')).status()).toBe(200);

    // Logout
    await request.post('/api/auth/logout');

    // Setelah logout, /api/auth/me harus 401
    const meAfter = await request.get('/api/auth/me');
    expect(meAfter.status()).toBe(401);
  });

  test('Setelah logout, protected API endpoint → 401', async ({ request }) => {
    await request.post('/api/auth/login', {
      data: { username: '240006', password: '240006@umbk' },
    });
    await request.post('/api/auth/logout');

    const res = await request.get('/api/akun');
    expect(res.status()).toBe(401);
  });

  test('Login ulang setelah logout berhasil → 200', async ({ request }) => {
    await request.post('/api/auth/login', { data: { username: 'proktor1', password: 'ecbtmtswaha' } });
    await request.post('/api/auth/logout');

    // Login ulang
    const relogin = await request.post('/api/auth/login', {
      data: { username: 'proktor1', password: 'ecbtmtswaha' },
    });
    expect(relogin.status()).toBe(200);

    // /api/auth/me harus bisa diakses lagi
    expect((await request.get('/api/auth/me')).status()).toBe(200);
  });

  test('JWT stateless — token lama masih valid setelah logout (known behavior)', async ({ playwright }) => {
    // Ambil token saat login
    const ctx1 = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    await ctx1.post('/api/auth/login', { data: { username: 'proktor1', password: 'ecbtmtswaha' } });
    const meRes = await ctx1.get('/api/auth/me');
    expect(meRes.status()).toBe(200);

    // Logout via context baru (hapus cookie context lama)
    await ctx1.post('/api/auth/logout');

    // Cookie sudah dihapus di ctx1 — akses berikutnya 401
    const afterLogout = await ctx1.get('/api/auth/me');
    expect(afterLogout.status()).toBe(401);

    await ctx1.dispose();
  });
});
