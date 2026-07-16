import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:3000';

// ── Kredensial dari seed-pg.sql ─────────────────────────────────────────────
const USERS = {
  proktor: { username: 'proktor1', password: 'ecbtmtswaha',  redirectTo: '/proktor/dashboard' },
  guru:    { username: '102008',   password: '102008@umbk',   redirectTo: '/guru/dashboard' },
  siswa:   { username: '240006',   password: '240006@umbk',   redirectTo: '/siswa/dashboard' },
};

// Selector spesifik untuk error box di dalam login form
const ERROR_ALERT = '.login-error[role="alert"]';

test.describe('Login Page — UI Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
  });

  test('halaman memuat dengan judul yang benar di browser', async ({ page }) => {
    await expect(page).toHaveTitle(/.+/);
  });

  test('menampilkan header Selamat Datang', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Selamat Datang' })).toBeVisible();
  });

  test('menampilkan subtitle instruksi login', async ({ page }) => {
    await expect(page.getByText('Silakan masuk menggunakan akun yang telah diberikan.')).toBeVisible();
  });

  test('menampilkan nama sekolah MTS WAHA di kolom kiri', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'MTS WAHA' })).toBeVisible();
  });

  test('menampilkan input username dengan label dan placeholder', async ({ page }) => {
    const input = page.locator('#login-username');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('placeholder', 'Masukkan username');
    await expect(page.locator('label[for="login-username"]')).toHaveText('Username');
  });

  test('menampilkan input password dengan label dan placeholder', async ({ page }) => {
    const input = page.locator('#login-password');
    await expect(input).toBeVisible();
    await expect(input).toHaveAttribute('type', 'password');
    await expect(input).toHaveAttribute('placeholder', 'Masukkan password');
    await expect(page.locator('label[for="login-password"]')).toHaveText('Password');
  });

  test('menampilkan tombol submit Masuk', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Masuk' })).toBeVisible();
  });

  test('menampilkan footer dengan tahun ajaran dan versi', async ({ page }) => {
    await expect(page.getByText(/Tahun Ajaran/)).toBeVisible();
    await expect(page.getByText(/2025.*2026/)).toBeVisible();
    await expect(page.getByText(/Sistem CBT/)).toBeVisible();
  });

  test('menampilkan logo MTS WAHA', async ({ page }) => {
    const logos = page.getByAltText('Logo MTS WAHA');
    await expect(logos.first()).toBeVisible();
  });

  test('tidak menampilkan error login saat halaman pertama kali dibuka', async ({ page }) => {
    await expect(page.locator(ERROR_ALERT)).not.toBeVisible();
  });

  test('form login menggunakan noValidate', async ({ page }) => {
    await expect(page.locator('form.login-form')).toHaveAttribute('novalidate', '');
  });
});

test.describe('Login Page — Toggle Show/Hide Password', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
  });

  test('password default tersembunyi (type=password)', async ({ page }) => {
    await expect(page.locator('#login-password')).toHaveAttribute('type', 'password');
  });

  test('klik toggle menampilkan password (type=text)', async ({ page }) => {
    await page.locator('#login-password').fill('testpassword');
    await page.getByRole('button', { name: /Tampilkan password/i }).click();
    await expect(page.locator('#login-password')).toHaveAttribute('type', 'text');
  });

  test('klik toggle kedua kali kembali menyembunyikan password', async ({ page }) => {
    await page.locator('#login-password').fill('testpassword');
    await page.getByRole('button', { name: /Tampilkan password/i }).click();
    await page.getByRole('button', { name: /Sembunyikan password/i }).click();
    await expect(page.locator('#login-password')).toHaveAttribute('type', 'password');
  });

  test('aria-label toggle berubah sesuai state', async ({ page }) => {
    const toggleBtn = page.getByRole('button', { name: /Tampilkan password/i });
    await expect(toggleBtn).toBeVisible();
    await toggleBtn.click();
    await expect(page.getByRole('button', { name: /Sembunyikan password/i })).toBeVisible();
  });

  test('value password tidak berubah saat toggle', async ({ page }) => {
    await page.locator('#login-password').fill('passwordsaya123');
    await page.getByRole('button', { name: /Tampilkan password/i }).click();
    await expect(page.locator('#login-password')).toHaveValue('passwordsaya123');
  });
});

test.describe('Login Page — Validasi Form (Server-side)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
  });

  test('submit dengan username dan password kosong — server return error 400', async ({ page }) => {
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 8000 });
    await expect(page.locator(ERROR_ALERT)).toContainText('wajib diisi');
  });

  test('submit dengan username kosong saja — server return error 400', async ({ page }) => {
    await page.locator('#login-password').fill('somepassword');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 8000 });
    await expect(page.locator(ERROR_ALERT)).toContainText('wajib diisi');
  });

  test('submit dengan password kosong saja — server return error 400', async ({ page }) => {
    await page.locator('#login-username').fill('someuser');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 8000 });
    await expect(page.locator(ERROR_ALERT)).toContainText('wajib diisi');
  });

  test('mengetik di input username menghapus error', async ({ page }) => {
    // Munculkan error dulu
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 8000 });
    // Ketik di username → error hilang
    await page.locator('#login-username').fill('a');
    await expect(page.locator(ERROR_ALERT)).not.toBeVisible();
  });

  test('mengetik di input password menghapus error', async ({ page }) => {
    // Munculkan error dulu
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 8000 });
    // Ketik di password → error hilang
    await page.locator('#login-password').fill('a');
    await expect(page.locator(ERROR_ALERT)).not.toBeVisible();
  });
});

test.describe('Login Page — Kredensial Salah', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
  });

  test('username tidak terdaftar menampilkan error', async ({ page }) => {
    await page.locator('#login-username').fill('usertidakada');
    await page.locator('#login-password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(ERROR_ALERT)).toContainText('Username atau password salah');
  });

  test('username benar tapi password salah menampilkan error', async ({ page }) => {
    await page.locator('#login-username').fill(USERS.proktor.username);
    await page.locator('#login-password').fill('passwordsalah123');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(ERROR_ALERT)).toContainText('Username atau password salah');
  });

  test('setelah error, form tetap menampilkan username yang diisi', async ({ page }) => {
    await page.locator('#login-username').fill('usersalah');
    await page.locator('#login-password').fill('passwordsalah');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#login-username')).toHaveValue('usersalah');
  });

  test('tidak redirect setelah login gagal — tetap di /login', async ({ page }) => {
    await page.locator('#login-username').fill('salah');
    await page.locator('#login-password').fill('salah');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 10000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test('password salah berulang tetap menampilkan error baru', async ({ page }) => {
    // Percobaan pertama
    await page.locator('#login-username').fill(USERS.proktor.username);
    await page.locator('#login-password').fill('salah1');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 10000 });
    // Percobaan kedua
    await page.locator('#login-password').fill('salah2');
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 10000 });
    await expect(page.locator(ERROR_ALERT)).toContainText('Username atau password salah');
  });
});

test.describe('Login Page — Login Sukses', () => {
  test('proktor login berhasil dan redirect ke /proktor/dashboard', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.locator('#login-username').fill(USERS.proktor.username);
    await page.locator('#login-password').fill(USERS.proktor.password);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page).toHaveURL(new RegExp(USERS.proktor.redirectTo), { timeout: 15000 });
    await expect(page.locator(ERROR_ALERT)).not.toBeVisible();
  });

  test('siswa login berhasil dan redirect ke /siswa/dashboard', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.locator('#login-username').fill(USERS.siswa.username);
    await page.locator('#login-password').fill(USERS.siswa.password);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page).toHaveURL(new RegExp(USERS.siswa.redirectTo), { timeout: 15000 });
    await expect(page.locator(ERROR_ALERT)).not.toBeVisible();
  });

  test('guru login berhasil dan redirect ke /guru/dashboard', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.locator('#login-username').fill(USERS.guru.username);
    await page.locator('#login-password').fill(USERS.guru.password);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page).toHaveURL(new RegExp(USERS.guru.redirectTo), { timeout: 15000 });
    await expect(page.locator(ERROR_ALERT)).not.toBeVisible();
  });

  test('cookie umbk-access-token di-set setelah login sukses', async ({ page, context }) => {
    await page.goto(`${BASE}/login`);
    await page.locator('#login-username').fill(USERS.proktor.username);
    await page.locator('#login-password').fill(USERS.proktor.password);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page).toHaveURL(new RegExp(USERS.proktor.redirectTo), { timeout: 15000 });
    const cookies = await context.cookies();
    const token = cookies.find(c => c.name === 'umbk-access-token');
    expect(token).toBeDefined();
    expect(token?.httpOnly).toBe(true);
  });
});

test.describe('Login Page — Loading State', () => {
  test('tombol berubah jadi Memverifikasi... saat submit', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.locator('#login-username').fill(USERS.proktor.username);
    await page.locator('#login-password').fill(USERS.proktor.password);

    await page.route('**/api/auth/login', async route => {
      await new Promise(r => setTimeout(r, 600));
      await route.continue();
    });

    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.getByText('Memverifikasi...')).toBeVisible({ timeout: 3000 });
  });

  test('input dinonaktifkan saat loading', async ({ page }) => {
    await page.goto(`${BASE}/login`);
    await page.locator('#login-username').fill(USERS.proktor.username);
    await page.locator('#login-password').fill(USERS.proktor.password);

    await page.route('**/api/auth/login', async route => {
      await new Promise(r => setTimeout(r, 600));
      await route.continue();
    });

    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.locator('#login-username')).toBeDisabled({ timeout: 3000 });
    await expect(page.locator('#login-password')).toBeDisabled({ timeout: 3000 });
    await expect(page.locator('button.login-btn')).toBeDisabled({ timeout: 3000 });
  });
});

test.describe('Login Page — Akses Halaman Login Saat Sudah Login', () => {
  test('pengguna yang sudah login diarahkan keluar dari /login', async ({ page }) => {
    // Login dulu
    await page.goto(`${BASE}/login`);
    await page.locator('#login-username').fill(USERS.proktor.username);
    await page.locator('#login-password').fill(USERS.proktor.password);
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page).toHaveURL(new RegExp(USERS.proktor.redirectTo), { timeout: 15000 });

    // Akses halaman login lagi — seharusnya redirect ke dashboard
    await page.goto(`${BASE}/login`);
    await expect(page).not.toHaveURL(/\/login/, { timeout: 8000 });
  });
});

test.describe('Login Page — Aksesibilitas', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${BASE}/login`);
  });

  test('form bisa diisi dan disubmit menggunakan keyboard saja', async ({ page }) => {
    await page.locator('#login-username').focus();
    await page.keyboard.type(USERS.proktor.username);
    await page.keyboard.press('Tab');
    await page.keyboard.type(USERS.proktor.password);
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(new RegExp(USERS.proktor.redirectTo), { timeout: 15000 });
  });

  test('error box memiliki role="alert"', async ({ page }) => {
    await page.getByRole('button', { name: 'Masuk' }).click();
    await expect(page.locator(ERROR_ALERT)).toBeVisible({ timeout: 8000 });
    await expect(page.locator(ERROR_ALERT)).toHaveAttribute('role', 'alert');
  });

  test('label username terhubung ke input via htmlFor', async ({ page }) => {
    await page.locator('label[for="login-username"]').click();
    await expect(page.locator('#login-username')).toBeFocused();
  });

  test('label password terhubung ke input via htmlFor', async ({ page }) => {
    await page.locator('label[for="login-password"]').click();
    await expect(page.locator('#login-password')).toBeFocused();
  });

  test('tombol toggle password tidak menyebabkan form submit', async ({ page }) => {
    await page.locator('#login-username').fill('test');
    await page.locator('#login-password').fill('test');
    // Klik toggle — tidak boleh trigger submit
    await page.getByRole('button', { name: /Tampilkan password/i }).click();
    // Tidak ada loading state
    await expect(page.getByText('Memverifikasi...')).not.toBeVisible();
  });
});
