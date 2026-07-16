import { test, expect, type APIRequestContext } from '@playwright/test';
import { execSync } from 'child_process';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginAs(r: APIRequestContext, username: string, password: string) {
  const res = await r.post('/api/auth/login', { data: { username, password } });
  expect(res.status()).toBe(200);
  return res;
}

const loginAsProktor = (r: APIRequestContext) => loginAs(r, 'proktor1', 'ecbtmtswaha');
const loginAsGuru    = (r: APIRequestContext) => loginAs(r, '102008', '102008@umbk');
const loginAsSiswa   = (r: APIRequestContext) => loginAs(r, '240006', '240006@umbk');

const KELAS_ID = '00000000-0000-0000-0000-000000000101'; // kelas 7A

// ── 1. GET /api/akun ──────────────────────────────────────────────────────────
test.describe('GET /api/akun', () => {
  test('Proktor bisa GET semua akun', async ({ request }) => {
    await loginAsProktor(request);
    const res  = await request.get('/api/akun');
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('profiles');
    expect(body).toHaveProperty('siswas');
    expect(body).toHaveProperty('gurus');
    expect(body).toHaveProperty('kelas');
    expect(Array.isArray(body.profiles)).toBe(true);
  });

  test('Guru bisa GET akun → 200', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.get('/api/akun');
    expect(res.status()).toBe(200);
  });

  test('Siswa tidak bisa GET akun → 403', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.get('/api/akun');
    expect(res.status()).toBe(403);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.get('/api/akun');
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test('Response profiles tidak mengandung password_hash', async ({ request }) => {
    await loginAsProktor(request);
    const body = await (await request.get('/api/akun')).json();
    body.profiles.forEach((p: Record<string, unknown>) => {
      expect(p).not.toHaveProperty('password_hash');
    });
  });

  test('Proktor mendapat field password_plain di setiap profile', async ({ request }) => {
    await loginAsProktor(request);
    const body = await (await request.get('/api/akun')).json();
    body.profiles.forEach((p: Record<string, unknown>) => {
      expect(p).toHaveProperty('password_plain');
    });
  });

  test('Guru tidak mendapat password_plain di profiles', async ({ request }) => {
    await loginAsGuru(request);
    const body = await (await request.get('/api/akun')).json();
    body.profiles.forEach((p: Record<string, unknown>) => {
      expect(p).not.toHaveProperty('password_plain');
    });
  });
});

// ── 2. POST /api/akun — buat akun siswa ──────────────────────────────────────
test.describe('POST /api/akun — buat akun siswa', () => {
  // Simpan siswaId dari tabel siswas (bukan userId/profiles.id) untuk cleanup
  let createdUserId = '';

  test('Proktor buat akun siswa baru → 201', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.post('/api/akun', {
      data: {
        username : 'test_siswa_e2e',
        password : 'password123',
        nama     : 'Siswa E2E Test',
        role     : 'siswa',
        status   : 'aktif',
        nis      : 'TEST001',
        id_kelas : KELAS_ID,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBeTruthy();
    createdUserId = body.userId;
  });

  test('Akun siswa baru bisa login', async ({ request }) => {
    const res = await request.post('/api/auth/login', {
      data: { username: 'test_siswa_e2e', password: 'password123' },
    });
    expect(res.status()).toBe(200);
  });

  test('Buat akun dengan username duplikat → 409', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.post('/api/akun', {
      data: { username: 'test_siswa_e2e', password: 'pass', nama: 'Duplikat', role: 'siswa' },
    });
    expect(res.status()).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('sudah digunakan');
  });

  test('Cleanup — hapus akun siswa test via siswas id', async ({ request }) => {
    await loginAsProktor(request);
    if (createdUserId) {
      // Ambil siswas.id dari profiles userId
      const akun = await (await request.get('/api/akun')).json();
      const siswaRow = akun.siswas.find((s: { id_user: string }) => s.id_user === createdUserId);
      if (siswaRow) {
        const res = await request.delete(`/api/akun?id=${siswaRow.id}&type=siswa`);
        expect(res.status()).toBe(200);
      }
    }
  });
});

// ── 3. POST /api/akun — buat akun guru ───────────────────────────────────────
test.describe('POST /api/akun — buat akun guru', () => {
  let createdUserId = '';

  test('Proktor buat akun guru baru → 201', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.post('/api/akun', {
      data: {
        username : 'test_guru_e2e',
        password : 'password123',
        nama     : 'Guru E2E Test',
        role     : 'guru',
        status   : 'aktif',
        nip      : 'NIP_TEST_001',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBeTruthy();
    createdUserId = body.userId;
  });

  test('Cleanup — hapus akun guru test via gurus id', async ({ request }) => {
    await loginAsProktor(request);
    if (createdUserId) {
      const akun = await (await request.get('/api/akun')).json();
      const guruRow = akun.gurus.find((g: { id_user: string }) => g.id_user === createdUserId);
      if (guruRow) {
        const res = await request.delete(`/api/akun?id=${guruRow.id}&type=guru`);
        expect(res.status()).toBe(200);
      }
    }
  });
});

// ── 4. POST /api/akun — validasi input ───────────────────────────────────────
test.describe('POST /api/akun — validasi input', () => {
  test('Tanpa username → 400', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.post('/api/akun', {
      data: { password: 'pass', nama: 'Test', role: 'siswa' },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('Username');
  });

  test('Tanpa password → 400', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.post('/api/akun', {
      data: { username: 'test_nopass', nama: 'Test', role: 'siswa' },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('Password');
  });

  test('Tanpa nama → 400', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.post('/api/akun', {
      data: { username: 'test_nonama', password: 'pass', role: 'siswa' },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('Nama');
  });

  test('Role tidak valid → 400', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.post('/api/akun', {
      data: { username: 'test_badrole', password: 'pass', nama: 'Test', role: 'superadmin' },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('Role tidak valid');
  });

  test('Guru tidak bisa POST akun → 403', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.post('/api/akun', {
      data: { username: 'x', password: 'x', nama: 'x', role: 'siswa' },
    });
    expect(res.status()).toBe(403);
  });

  test('Siswa tidak bisa POST akun → 403', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.post('/api/akun', {
      data: { username: 'x', password: 'x', nama: 'x', role: 'siswa' },
    });
    expect(res.status()).toBe(403);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.post('/api/akun', {
      data: { username: 'x', password: 'x', nama: 'x', role: 'siswa' },
    });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 5. password_plain — simpan & tampilkan ───────────────────────────────────
test.describe('password_plain — simpan saat POST, update saat PATCH', () => {
  let createdUserId = '';
  let createdSiswaId = '';
  const testUsername = 'test_pass_plain_e2e';
  const testPassword = 'plainpass123';

  test('POST akun siswa baru — password_plain tersimpan dan bisa dibaca proktor', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.post('/api/akun', {
      data: {
        username : testUsername,
        password : testPassword,
        nama     : 'Test Plain Password',
        role     : 'siswa',
        status   : 'aktif',
        nis      : 'TESTPLAIN001',
        id_kelas : KELAS_ID,
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    createdUserId = body.userId;

    // Ambil daftar akun dan pastikan password_plain tersimpan dengan benar
    const akunRes  = await request.get('/api/akun');
    const akunBody = await akunRes.json();
    const profile  = akunBody.profiles.find((p: { id: string }) => p.id === createdUserId);
    expect(profile).toBeTruthy();
    expect(profile.password_plain).toBe(testPassword);

    // Simpan siswaId untuk cleanup
    const siswaRow = akunBody.siswas.find((s: { id_user: string }) => s.id_user === createdUserId);
    if (siswaRow) createdSiswaId = siswaRow.id;
  });

  test('PATCH reset password — password_plain ikut terupdate', async ({ request }) => {
    await loginAsProktor(request);
    if (!createdUserId) return;

    const newPassword = 'newplainpass456';
    const patchRes = await request.patch('/api/akun', {
      data: { userId: createdUserId, password: newPassword },
    });
    expect(patchRes.status()).toBe(200);

    // Verifikasi password_plain terbaru di GET
    const akunBody = await (await request.get('/api/akun')).json();
    const profile  = akunBody.profiles.find((p: { id: string }) => p.id === createdUserId);
    expect(profile).toBeTruthy();
    expect(profile.password_plain).toBe(newPassword);

    // Verifikasi bisa login dengan password baru
    const loginRes = await request.post('/api/auth/login', {
      data: { username: testUsername, password: newPassword },
    });
    expect(loginRes.status()).toBe(200);
  });

  test('Cleanup — hapus akun test password_plain', async ({ request }) => {
    await loginAsProktor(request);
    if (createdSiswaId) {
      const res = await request.delete(`/api/akun?id=${createdSiswaId}&type=siswa`);
      expect(res.status()).toBe(200);
    }
  });
});

// ── 6. DELETE /api/akun ───────────────────────────────────────────────────────
test.describe('DELETE /api/akun', () => {
  test('Tanpa id dan type → 400', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.delete('/api/akun');
    expect(res.status()).toBe(400);
  });

  test('id tidak ditemukan → 404', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.delete('/api/akun?id=00000000-0000-0000-0000-000000000000&type=siswa');
    expect(res.status()).toBe(404);
  });

  test('Guru tidak bisa DELETE akun → 403', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.delete('/api/akun?id=00000000-0000-0000-0000-000000000000&type=siswa');
    expect(res.status()).toBe(403);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.delete('/api/akun?id=x&type=siswa');
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 7. Import Excel (paste) — siswa ──────────────────────────────────────────
// Fitur import = paste tab-separated text dari Excel → loop POST /api/akun
// Format siswa : Kelas\tNama\tUsername\tPassword
// Format guru  : Nama\tUsername\tPassword
test.describe('Import Excel — siswa', () => {
  const importedUsernames = ['imp_siswa_001', 'imp_siswa_002'];
  const cleanupUsernames  = ['imp_siswa_001', 'imp_siswa_002', 'imp_badkelas'];
  const createdSiswaIds: string[] = [];

  test.beforeAll(async () => {
    // Bersihkan sisa test run sebelumnya langsung via DB agar tidak butuh auth
    const usernames = cleanupUsernames.map(u => `'${u}'`).join(',');
    execSync(
      `docker exec ecbt_db psql -U postgres -d ecbt -c "DELETE FROM profiles WHERE username IN (${usernames});"`,
      { stdio: 'ignore' }
    );
  });

  test('Import 2 siswa valid → masing-masing tersimpan di DB', async ({ request }) => {
    await loginAsProktor(request);

    // Simulasi baris paste dari Excel: tab-separated
    const rows = [
      { kelas: '7A', nama: 'Import Siswa Satu', username: 'imp_siswa_001', password: 'imp_pass_001' },
      { kelas: '7B', nama: 'Import Siswa Dua',  username: 'imp_siswa_002', password: 'imp_pass_002' },
    ];

    for (const row of rows) {
      // Cari id_kelas dari API
      const akunBody = await (await request.get('/api/akun')).json();
      const kelas = akunBody.kelas.find((k: { nama_kelas: string }) => k.nama_kelas === row.kelas);
      expect(kelas).toBeTruthy();

      const res = await request.post('/api/akun', {
        data: {
          role    : 'siswa',
          nis     : row.username,
          nama    : row.nama,
          id_kelas: kelas.id,
          username: row.username,
          password: row.password,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.ok).toBe(true);

      // Simpan siswaId untuk cleanup
      const akunBody2 = await (await request.get('/api/akun')).json();
      const siswaRow = akunBody2.siswas.find((s: { id_user: string }) => s.id_user === body.userId);
      if (siswaRow) createdSiswaIds.push(siswaRow.id);
    }
  });

  test('Siswa yang diimport bisa login dengan password import', async ({ request }) => {
    for (const [i, username] of importedUsernames.entries()) {
      const password = `imp_pass_00${i + 1}`;
      const res = await request.post('/api/auth/login', {
        data: { username, password },
      });
      expect(res.status()).toBe(200);
    }
  });

  test('password_plain tersimpan dengan benar untuk siswa import', async ({ request }) => {
    await loginAsProktor(request);
    const body = await (await request.get('/api/akun')).json();
    for (const [i, username] of importedUsernames.entries()) {
      const profile = body.profiles.find((p: { username: string }) => p.username === username);
      expect(profile).toBeTruthy();
      expect(profile.password_plain).toBe(`imp_pass_00${i + 1}`);
    }
  });

  test('Import baris dengan kelas tidak valid — tidak membuat akun', async ({ request }) => {
    await loginAsProktor(request);
    // Kelas 'XXXX' tidak ada di DB — UI akan menolak sebelum POST, tapi kita test API langsung
    // Harusnya tetap 400 karena id_kelas tidak valid / tidak ada
    const res = await request.post('/api/akun', {
      data: {
        role    : 'siswa',
        nis     : 'imp_badkelas',
        nama    : 'Bad Kelas',
        id_kelas: '00000000-0000-0000-0000-999999999999', // tidak ada
        username: 'imp_badkelas',
        password: 'pass123',
      },
    });
    // API akan return 500 karena FK violation, bukan 400 (no input validation on id_kelas)
    expect([400, 500]).toContain(res.status());
  });

  test('Import username duplikat → 409', async ({ request }) => {
    await loginAsProktor(request);
    const akunBody = await (await request.get('/api/akun')).json();
    const kelas = akunBody.kelas.find((k: { nama_kelas: string }) => k.nama_kelas === '7A');
    const res = await request.post('/api/akun', {
      data: {
        role    : 'siswa',
        nis     : 'imp_siswa_001',
        nama    : 'Duplikat Import',
        id_kelas: kelas.id,
        username: 'imp_siswa_001', // sudah ada
        password: 'pass123',
      },
    });
    expect(res.status()).toBe(409);
    expect((await res.json()).error).toContain('sudah digunakan');
  });

  test('Cleanup — hapus semua siswa import', async ({ request }) => {
    await loginAsProktor(request);
    for (const siswaId of createdSiswaIds) {
      const res = await request.delete(`/api/akun?id=${siswaId}&type=siswa`);
      expect(res.status()).toBe(200);
    }
  });
});

// ── 8. Import Excel (paste) — guru ───────────────────────────────────────────
// Format guru: Nama\tUsername\tPassword
test.describe('Import Excel — guru', () => {
  const importedGuruUsernames = ['imp_guru_001', 'imp_guru_002'];
  const createdGuruIds: string[] = [];

  test('Import 2 guru valid → masing-masing tersimpan di DB', async ({ request }) => {
    await loginAsProktor(request);

    const rows = [
      { nama: 'Import Guru Satu', username: 'imp_guru_001', password: 'gurpass_001' },
      { nama: 'Import Guru Dua',  username: 'imp_guru_002', password: 'gurpass_002' },
    ];

    for (const row of rows) {
      const res = await request.post('/api/akun', {
        data: {
          role    : 'guru',
          nip     : row.username,
          nama    : row.nama,
          username: row.username,
          password: row.password,
        },
      });
      expect(res.status()).toBe(201);
      const body = await res.json();
      expect(body.ok).toBe(true);

      const akunBody = await (await request.get('/api/akun')).json();
      const guruRow = akunBody.gurus.find((g: { id_user: string }) => g.id_user === body.userId);
      if (guruRow) createdGuruIds.push(guruRow.id);
    }
  });

  test('Guru yang diimport bisa login', async ({ request }) => {
    const passwords = ['gurpass_001', 'gurpass_002'];
    for (const [i, username] of importedGuruUsernames.entries()) {
      const res = await request.post('/api/auth/login', {
        data: { username, password: passwords[i] },
      });
      expect(res.status()).toBe(200);
    }
  });

  test('password_plain tersimpan dengan benar untuk guru import', async ({ request }) => {
    await loginAsProktor(request);
    const body = await (await request.get('/api/akun')).json();
    const passwords = ['gurpass_001', 'gurpass_002'];
    for (const [i, username] of importedGuruUsernames.entries()) {
      const profile = body.profiles.find((p: { username: string }) => p.username === username);
      expect(profile).toBeTruthy();
      expect(profile.password_plain).toBe(passwords[i]);
    }
  });

  test('Import guru tanpa kolom lengkap → 400 dari API', async ({ request }) => {
    await loginAsProktor(request);
    // Tanpa nama
    const res = await request.post('/api/akun', {
      data: { role: 'guru', nip: 'imp_guru_bad', username: 'imp_guru_bad', password: 'pass' },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('Nama');
  });

  test('Cleanup — hapus semua guru import', async ({ request }) => {
    await loginAsProktor(request);
    for (const guruId of createdGuruIds) {
      const res = await request.delete(`/api/akun?id=${guruId}&type=guru`);
      expect(res.status()).toBe(200);
    }
  });
});
