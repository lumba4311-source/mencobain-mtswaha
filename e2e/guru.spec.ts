import { test, expect, type APIRequestContext } from '@playwright/test';

// ── Helper ────────────────────────────────────────────────────────────────────
async function loginAsGuru(request: APIRequestContext, username = '102008', password = '102008@umbk') {
  const res = await request.post('/api/auth/login', { data: { username, password } });
  expect(res.status()).toBe(200);
  return res;
}

// Soal sample untuk digunakan di beberapa test
const SAMPLE_SOALS = [
  {
    nomor: 1, pertanyaan: 'Ibu kota Indonesia?',
    opsi_a: 'Bandung', opsi_b: 'Jakarta', opsi_c: 'Surabaya', opsi_d: 'Medan',
    jawaban_benar: 'B', bobot: 1,
  },
  {
    nomor: 2, pertanyaan: '2 + 2 = ?',
    opsi_a: '3', opsi_b: '4', opsi_c: '5', opsi_d: '6',
    jawaban_benar: 'B', bobot: 1,
  },
  {
    nomor: 3, pertanyaan: 'Warna langit cerah?',
    opsi_a: 'Merah', opsi_b: 'Hijau', opsi_c: 'Biru', opsi_d: 'Kuning',
    jawaban_benar: 'C', bobot: 1,
  },
];

// ── 1. API: Guru buat ujian ───────────────────────────────────────────────────
test.describe('Guru API — buat ujian', () => {
  test('POST /api/ujian → 201 + id dikembalikan', async ({ request }) => {
    await loginAsGuru(request);

    const res = await request.post('/api/ujian', {
      data: {
        nama_ujian: 'Ujian IPA Kelas 8',
        jenis_ujian: 'LATIHAN',
        durasi: 90,
        acak_soal: true,
        acak_opsi: true,
        tampil_hasil: false,
        kelas_ids: [],
      },
    });

    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    expect(body.nama_ujian).toBe('Ujian IPA Kelas 8');
    expect(body.jenis_ujian).toBe('LATIHAN');

    // Cleanup
    await request.delete(`/api/ujian/${body.id}`);
  });

  test('POST /api/ujian dengan semua field wajib → 201', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.post('/api/ujian', {
      data: { nama_ujian: 'Test Minimal', jenis_ujian: 'PTS', durasi: 60 },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('id');
    await request.delete(`/api/ujian/${body.id}`);
  });

  test('GET /api/ujian?guruId=[id] hanya mengembalikan ujian milik guru tsb', async ({ request }) => {
    await loginAsGuru(request);

    // Ambil data guru dulu
    const meRes = await request.get('/api/auth/me');
    const me = await meRes.json();
    const guruId = me.guru?.id;
    expect(guruId).toBeTruthy();

    // Buat 2 ujian
    const u1 = await (await request.post('/api/ujian', {
      data: { nama_ujian: 'Ujian Filter A', jenis_ujian: 'LATIHAN', durasi: 90 },
    })).json();
    const u2 = await (await request.post('/api/ujian', {
      data: { nama_ujian: 'Ujian Filter B', jenis_ujian: 'UAS', durasi: 120 },
    })).json();

    // GET dengan filter guruId
    const listRes = await request.get(`/api/ujian?guruId=${guruId}`);
    expect(listRes.status()).toBe(200);
    const list = await listRes.json();
    const ids = list.map((u: { id: string }) => u.id);
    expect(ids).toContain(u1.id);
    expect(ids).toContain(u2.id);
    // Semua hasil harus milik guru ini
    list.forEach((u: { id_guru: string }) => {
      expect(u.id_guru).toBe(guruId);
    });

    // Cleanup
    await request.delete(`/api/ujian/${u1.id}`);
    await request.delete(`/api/ujian/${u2.id}`);
  });
});

// ── 2. API: Guru input soal ───────────────────────────────────────────────────
test.describe('Guru API — input soal', () => {
  let ujianId: string;

  test.beforeEach(async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.post('/api/ujian', {
      data: { nama_ujian: 'Ujian Soal Test', jenis_ujian: 'LATIHAN', durasi: 90 },
    });
    const ujian = await res.json();
    ujianId = ujian.id;
  });

  test.afterEach(async ({ request }) => {
    await loginAsGuru(request);
    if (ujianId) await request.delete(`/api/ujian/${ujianId}`);
  });

  test('POST /api/soal/[ujianId] menyimpan soal → 200 ok:true', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.post(`/api/soal/${ujianId}`, {
      data: { soals: SAMPLE_SOALS },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('GET /api/soal/[ujianId] sebagai guru mengembalikan jawaban_benar', async ({ request }) => {
    await loginAsGuru(request);

    // Simpan soal dulu
    await request.post(`/api/soal/${ujianId}`, { data: { soals: SAMPLE_SOALS } });

    // Ambil soal sebagai guru
    const res = await request.get(`/api/soal/${ujianId}`);
    expect(res.status()).toBe(200);
    const soals = await res.json();

    expect(soals.length).toBe(SAMPLE_SOALS.length);
    // Guru harus mendapat jawaban_benar
    soals.forEach((s: Record<string, unknown>) => {
      expect(s).toHaveProperty('jawaban_benar');
      expect(['A', 'B', 'C', 'D']).toContain(s.jawaban_benar);
    });
  });

  test('POST /api/soal/[ujianId] replace semua soal (idempoten)', async ({ request }) => {
    await loginAsGuru(request);

    // Simpan 3 soal
    await request.post(`/api/soal/${ujianId}`, { data: { soals: SAMPLE_SOALS } });

    // Replace dengan 1 soal saja
    const newSoal = [{
      nomor: 1, pertanyaan: 'Replaced question',
      opsi_a: 'A', opsi_b: 'B', opsi_c: 'C', opsi_d: 'D',
      jawaban_benar: 'A', bobot: 1,
    }];
    await request.post(`/api/soal/${ujianId}`, { data: { soals: newSoal } });

    // Harus hanya ada 1 soal sekarang
    const getRes = await request.get(`/api/soal/${ujianId}`);
    const soals = await getRes.json();
    expect(soals.length).toBe(1);
    expect(soals[0].pertanyaan).toBe('Replaced question');
  });

  test('soal_count di /api/ujian update setelah soal ditambahkan', async ({ request }) => {
    await loginAsGuru(request);
    const meRes = await request.get('/api/auth/me');
    const me = await meRes.json();
    const guruId = me.guru?.id;

    // Tambahkan soal
    await request.post(`/api/soal/${ujianId}`, { data: { soals: SAMPLE_SOALS } });

    // GET ujian list — soal_count harus 3
    const listRes = await request.get(`/api/ujian?guruId=${guruId}`);
    const list = await listRes.json();
    const thisUjian = list.find((u: { id: string }) => u.id === ujianId);
    expect(thisUjian).toBeTruthy();
    expect(thisUjian.soal_count).toBe(SAMPLE_SOALS.length);
  });
});

// ── 3. UI: Guru dashboard memuat daftar ujian ─────────────────────────────────
test('Guru UI — dashboard menampilkan daftar ujian', async ({ page }) => {
  // Login
  await page.goto('/login');
  await page.locator('#login-username').fill('102008');
  await page.locator('#login-password').fill('102008@umbk');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL('**/guru/dashboard', { timeout: 10_000 });

  // Dashboard harus render tanpa error
  await expect(page).toHaveURL(/guru\/dashboard/);
  // Tombol buat ujian ada
  await expect(page.getByRole('link', { name: /Buat Ujian/i })).toBeVisible({ timeout: 8_000 });
});

// ── 4. UI: Halaman buat ujian ─────────────────────────────────────────────────
test('Guru UI — halaman /guru/ujian/buat menampilkan form', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-username').fill('102008');
  await page.locator('#login-password').fill('102008@umbk');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL('**/guru/dashboard', { timeout: 10_000 });

  // Navigasi via klik link dari dashboard agar auth context sudah siap
  await expect(page.getByRole('link', { name: /Buat Ujian/i })).toBeVisible({ timeout: 8_000 });
  await page.getByRole('link', { name: /Buat Ujian/i }).click();
  await page.waitForURL('**/guru/ujian/buat', { timeout: 8_000 });
  await page.waitForLoadState('networkidle');

  // Harus ada input nama ujian (id="nama_ujian" dari BuatUjianPage)
  await expect(page.locator('#nama_ujian')).toBeVisible({ timeout: 10_000 });
  // Tombol submit
  await expect(page.getByRole('button', { name: /Buat.*Soal|Simpan/i })).toBeVisible();
});

// ── 5. UI: Buat ujian via form → redirect ke /guru/soal?ujian=[id] ─────────────
test('Guru UI — submit form buat ujian redirect ke halaman soal', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-username').fill('12003');
  await page.locator('#login-password').fill('12003@umbk');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL('**/guru/dashboard', { timeout: 10_000 });

  // Navigasi via klik link dari dashboard agar auth context sudah siap
  await expect(page.getByRole('link', { name: /Buat Ujian/i })).toBeVisible({ timeout: 8_000 });
  await page.getByRole('link', { name: /Buat Ujian/i }).click();
  await page.waitForURL('**/guru/ujian/buat', { timeout: 8_000 });
  await page.waitForLoadState('networkidle');

  // Tunggu komponen selesai hydrate — input muncul setelah auth check
  await expect(page.locator('#nama_ujian')).toBeVisible({ timeout: 10_000 });

  // Isi nama ujian
  await page.locator('#nama_ujian').fill('Ujian E2E Test UI');

  // Klik tombol submit
  await page.getByRole('button', { name: /Buat.*Soal|Simpan/i }).click();

  // Harus redirect ke /guru/soal?ujian=...
  await page.waitForURL('**/guru/soal**', { timeout: 12_000 });
  await expect(page).toHaveURL(/\/guru\/soal\?ujian=/);

  // Cleanup — hapus ujian yang baru dibuat
  const url = page.url();
  const ujianId = new URL(url).searchParams.get('ujian');
  if (ujianId) {
    await page.request.delete(`/api/ujian/${ujianId}`);
  }
});

// ── 6. API: DELETE ujian milik sendiri ───────────────────────────────────────
test('Guru API — DELETE /api/ujian/[id] ujian milik sendiri → 200', async ({ request }) => {
  await loginAsGuru(request);

  // Buat ujian
  const createRes = await request.post('/api/ujian', {
    data: { nama_ujian: 'Ujian Hapus Test', jenis_ujian: 'LATIHAN', durasi: 90 },
  });
  const ujian = await createRes.json();

  // Hapus
  const delRes = await request.delete(`/api/ujian/${ujian.id}`);
  expect(delRes.status()).toBe(200);
  const body = await delRes.json();
  expect(body.ok).toBe(true);
});
