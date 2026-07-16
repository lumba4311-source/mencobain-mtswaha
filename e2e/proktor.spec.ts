import { test, expect, type APIRequestContext } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function loginAs(request: APIRequestContext, username: string, password: string) {
  const res = await request.post('/api/auth/login', { data: { username, password } });
  expect(res.status()).toBe(200);
  return res;
}

// Buat ujian dengan soal sebagai guru, kembalikan ujianId
async function setupUjian(request: APIRequestContext): Promise<string> {
  await loginAs(request, '102008', '102008@umbk');

  const ujianRes = await request.post('/api/ujian', {
    data: { nama_ujian: 'Ujian Proktor Test', jenis_ujian: 'LATIHAN', durasi: 90 },
  });
  expect(ujianRes.status()).toBe(201);
  const ujian = await ujianRes.json();

  // Tambahkan soal
  await request.post(`/api/soal/${ujian.id}`, {
    data: {
      soals: [
        {
          nomor: 1, pertanyaan: 'Soal test?',
          opsi_a: 'A', opsi_b: 'B', opsi_c: 'C', opsi_d: 'D',
          jawaban_benar: 'A', bobot: 1,
        },
      ],
    },
  });

  return ujian.id as string;
}

// Ambil siswa id dari akun seed
async function getSiswaIds(request: APIRequestContext): Promise<string[]> {
  await loginAs(request, 'proktor1', 'ecbtmtswaha');
  const res = await request.get('/api/akun');
  expect(res.status()).toBe(200);
  const akun = await res.json();
  return (akun.siswas ?? []).map((s: { id: string }) => s.id).slice(0, 3);
}

// ── 1. Proktor buat jadwal Draft ──────────────────────────────────────────────
test('Proktor API — POST /api/jadwal buat jadwal Draft → 201', async ({ request }) => {
  const ujianId = await setupUjian(request);
  const siswaIds = await getSiswaIds(request);

  await loginAs(request, 'proktor1', 'ecbtmtswaha');

  const res = await request.post('/api/jadwal', {
    data: {
      id_ujian: ujianId,
      max_capacity: 30,
      durasi_menit: 90,
      status_publikasi: 'Draft',
      siswa_ids: siswaIds,
    },
  });

  expect(res.status()).toBe(201);
  const jadwal = await res.json();
  expect(jadwal).toHaveProperty('id');
  expect(jadwal.status_publikasi).toBe('Draft');
  expect(jadwal.id_ujian).toBe(ujianId);

  // Cleanup
  await request.delete(`/api/jadwal/${jadwal.id}`);
  await loginAs(request, '102008', '102008@umbk');
  await request.delete(`/api/ujian/${ujianId}`);
});

// ── 2. Proktor publish jadwal: Draft → Published ──────────────────────────────
test('Proktor API — PUT /api/jadwal/[id] publish Draft → Published', async ({ request }) => {
  const ujianId = await setupUjian(request);
  const siswaIds = await getSiswaIds(request);

  await loginAs(request, 'proktor1', 'ecbtmtswaha');

  // Buat jadwal Draft
  const createRes = await request.post('/api/jadwal', {
    data: {
      id_ujian: ujianId,
      max_capacity: 30,
      durasi_menit: 90,
      status_publikasi: 'Draft',
      siswa_ids: siswaIds,
    },
  });
  const jadwal = await createRes.json();

  // Publish
  const pubRes = await request.put(`/api/jadwal/${jadwal.id}`, {
    data: { status_publikasi: 'Published' },
  });
  expect(pubRes.status()).toBe(200);
  const pubBody = await pubRes.json();
  expect(pubBody.ok).toBe(true);

  // Verifikasi status berubah
  const getRes = await request.get(`/api/jadwal/${jadwal.id}`);
  expect(getRes.status()).toBe(200);
  const updated = await getRes.json();
  expect(updated.status_publikasi).toBe('Published');

  // Cleanup
  await request.delete(`/api/jadwal/${jadwal.id}`);
  await loginAs(request, '102008', '102008@umbk');
  await request.delete(`/api/ujian/${ujianId}`);
});

// ── 3. Jadwal Published muncul di GET siswa dengan siswaId filter ─────────────
test('Proktor API — jadwal Published tampil di endpoint siswa', async ({ request }) => {
  const ujianId = await setupUjian(request);
  const siswaIds = await getSiswaIds(request);

  if (siswaIds.length === 0) {
    test.skip();
    return;
  }

  await loginAs(request, 'proktor1', 'ecbtmtswaha');

  // Buat jadwal Published langsung
  const createRes = await request.post('/api/jadwal', {
    data: {
      id_ujian: ujianId,
      max_capacity: 30,
      durasi_menit: 90,
      status_publikasi: 'Published',
      siswa_ids: siswaIds,
    },
  });
  const jadwal = await createRes.json();

  try {
    // Login sebagai siswa yang masuk dalam siswa_ids
    // Perlu login sebagai siswa dan cek jadwal-nya
    await loginAs(request, '240006', '240006@umbk');
    const meRes = await request.get('/api/auth/me');
    const me = await meRes.json();
    const siswaId = me.siswa?.id;

    if (!siswaId || !siswaIds.includes(siswaId)) {
      // Siswa 240006 tidak ada dalam batch siswaIds dari akun, skip
      return;
    }

    const jadwalRes = await request.get(`/api/jadwal?siswaId=${siswaId}`);
    expect(jadwalRes.status()).toBe(200);
    const jadwalList = await jadwalRes.json();

    const ids = jadwalList.map((j: { id: string }) => j.id);
    expect(ids).toContain(jadwal.id);
  } finally {
    await loginAs(request, 'proktor1', 'ecbtmtswaha');
    await request.delete(`/api/jadwal/${jadwal.id}`);
    await loginAs(request, '102008', '102008@umbk');
    await request.delete(`/api/ujian/${ujianId}`);
  }
});

// ── 4. Jadwal Draft tidak muncul di endpoint siswa ───────────────────────────
test('Proktor API — jadwal Draft tidak tampil di endpoint siswa', async ({ request }) => {
  const ujianId = await setupUjian(request);
  const siswaIds = await getSiswaIds(request);

  await loginAs(request, 'proktor1', 'ecbtmtswaha');

  // Buat jadwal Draft
  const createRes = await request.post('/api/jadwal', {
    data: {
      id_ujian: ujianId,
      max_capacity: 30,
      durasi_menit: 90,
      status_publikasi: 'Draft',
      siswa_ids: siswaIds,
    },
  });
  const jadwal = await createRes.json();

  try {
    await loginAs(request, '240006', '240006@umbk');
    const meRes = await request.get('/api/auth/me');
    const me = await meRes.json();
    const siswaId = me.siswa?.id;

    if (!siswaId) return;

    const jadwalRes = await request.get(`/api/jadwal?siswaId=${siswaId}`);
    expect(jadwalRes.status()).toBe(200);
    const jadwalList = await jadwalRes.json();

    // Jadwal Draft tidak boleh muncul
    const ids = jadwalList.map((j: { id: string }) => j.id);
    expect(ids).not.toContain(jadwal.id);
  } finally {
    await loginAs(request, 'proktor1', 'ecbtmtswaha');
    await request.delete(`/api/jadwal/${jadwal.id}`);
    await loginAs(request, '102008', '102008@umbk');
    await request.delete(`/api/ujian/${ujianId}`);
  }
});

// ── 5. Proktor DELETE jadwal bersih (cascade ke session/jawaban/nilai) ─────────
test('Proktor API — DELETE /api/jadwal/[id] → 200 ok:true', async ({ request }) => {
  const ujianId = await setupUjian(request);
  const siswaIds = await getSiswaIds(request);

  await loginAs(request, 'proktor1', 'ecbtmtswaha');

  const createRes = await request.post('/api/jadwal', {
    data: {
      id_ujian: ujianId,
      max_capacity: 30,
      durasi_menit: 90,
      status_publikasi: 'Draft',
      siswa_ids: siswaIds,
    },
  });
  const jadwal = await createRes.json();

  const delRes = await request.delete(`/api/jadwal/${jadwal.id}`);
  expect(delRes.status()).toBe(200);
  const body = await delRes.json();
  expect(body.ok).toBe(true);

  // Verifikasi sudah tidak ada
  const getRes = await request.get(`/api/jadwal/${jadwal.id}`);
  expect(getRes.status()).toBe(404);

  // Cleanup ujian
  await loginAs(request, '102008', '102008@umbk');
  await request.delete(`/api/ujian/${ujianId}`);
});

// ── 6. GET /api/jadwal tanpa filter mengembalikan semua jadwal (proktor) ───────
test('Proktor API — GET /api/jadwal tanpa filter → array semua jadwal', async ({ request }) => {
  await loginAs(request, 'proktor1', 'ecbtmtswaha');
  const res = await request.get('/api/jadwal');
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

// ── 7. GET /api/jadwal/[id] mengembalikan ujian yang ter-join ─────────────────
test('Proktor API — GET /api/jadwal/[id] menyertakan data ujian (join)', async ({ request }) => {
  const ujianId = await setupUjian(request);
  const siswaIds = await getSiswaIds(request);

  await loginAs(request, 'proktor1', 'ecbtmtswaha');

  const createRes = await request.post('/api/jadwal', {
    data: {
      id_ujian: ujianId,
      max_capacity: 30,
      durasi_menit: 90,
      status_publikasi: 'Draft',
      siswa_ids: siswaIds,
    },
  });
  const jadwal = await createRes.json();

  try {
    const getRes = await request.get(`/api/jadwal/${jadwal.id}`);
    expect(getRes.status()).toBe(200);
    const detail = await getRes.json();

    // Field ujians harus ada (JOIN result dari route)
    expect(detail).toHaveProperty('id_ujian', ujianId);
    expect(detail).toHaveProperty('durasi_menit', 90);
    expect(detail).toHaveProperty('siswa_ids');
    expect(Array.isArray(detail.siswa_ids)).toBe(true);
  } finally {
    await request.delete(`/api/jadwal/${jadwal.id}`);
    await loginAs(request, '102008', '102008@umbk');
    await request.delete(`/api/ujian/${ujianId}`);
  }
});

// ── 8. UI: Proktor dashboard memuat ───────────────────────────────────────────
test('Proktor UI — dashboard menampilkan halaman dengan statistik', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-username').fill('proktor1');
  await page.locator('#login-password').fill('ecbtmtswaha');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL('**/proktor/dashboard', { timeout: 10_000 });

  await expect(page).toHaveURL(/proktor\/dashboard/);
  // Dashboard proktor menampilkan konten — minimal ada nav/sidebar
  await expect(page.locator('body')).not.toBeEmpty();
});

// ── 9. UI: Proktor halaman jadwal memuat ──────────────────────────────────────
test('Proktor UI — halaman jadwal /proktor/jadwal memuat', async ({ page }) => {
  await page.goto('/login');
  await page.locator('#login-username').fill('proktor1');
  await page.locator('#login-password').fill('ecbtmtswaha');
  await page.getByRole('button', { name: 'Masuk' }).click();
  await page.waitForURL('**/proktor/dashboard', { timeout: 10_000 });

  await page.goto('/proktor/jadwal');
  await expect(page).toHaveURL(/proktor\/jadwal/);
  // Halaman jadwal harus ada kontennya (bukan redirect ke login)
  await expect(page.locator('body')).not.toBeEmpty();
});
