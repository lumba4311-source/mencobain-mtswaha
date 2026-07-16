import { test, expect, type APIRequestContext } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function loginAs(
  request: APIRequestContext,
  username: string,
  password: string,
) {
  const res = await request.post('/api/auth/login', { data: { username, password } });
  expect(res.status()).toBe(200);
  return res;
}

const loginAsGuru     = (r: APIRequestContext) => loginAs(r, '102008', '102008@umbk');
const loginAsGuru2    = (r: APIRequestContext) => loginAs(r, '111009', '111009@umbk'); // siswa — tidak punya akses guru
const loginAsSiswa    = (r: APIRequestContext) => loginAs(r, '240006', '240006@umbk');
const loginAsProktor  = (r: APIRequestContext) => loginAs(r, 'proktor1', 'ecbtmtswaha');

// ── Soal fixtures ─────────────────────────────────────────────────────────────

const SOAL_AWAL = [
  { nomor: 1, pertanyaan: 'Pertanyaan A', opsi_a: 'P', opsi_b: 'Q', opsi_c: 'R', opsi_d: 'S', jawaban_benar: 'A', bobot: 1 },
  { nomor: 2, pertanyaan: 'Pertanyaan B', opsi_a: 'P', opsi_b: 'Q', opsi_c: 'R', opsi_d: 'S', jawaban_benar: 'B', bobot: 1 },
  { nomor: 3, pertanyaan: 'Pertanyaan C', opsi_a: 'P', opsi_b: 'Q', opsi_c: 'R', opsi_d: 'S', jawaban_benar: 'C', bobot: 2 },
];

// ── Shared state ──────────────────────────────────────────────────────────────
let ujianId = '';

// ── 1. Setup: buat ujian kosong ───────────────────────────────────────────────
test.describe('Setup', () => {
  test('Guru buat ujian kosong untuk manage soal test', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.post('/api/ujian', {
      data: { nama_ujian: 'Manage Soal Test', jenis_ujian: 'LATIHAN', durasi: 60 },
    });
    expect(res.status()).toBe(201);
    const ujian = await res.json();
    ujianId = ujian.id;
    expect(ujianId).toBeTruthy();
  });
});

// ── 2. Input soal awal (bulk replace) ─────────────────────────────────────────
test.describe('Input soal pertama kali', () => {
  test('POST /api/soal/[ujianId] simpan 3 soal → ok:true', async ({ request }) => {
    expect(ujianId).toBeTruthy();
    await loginAsGuru(request);

    const res = await request.post(`/api/soal/${ujianId}`, {
      data: { soals: SOAL_AWAL },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('GET /api/soal/[ujianId] mengembalikan 3 soal urut nomor', async ({ request }) => {
    await loginAsGuru(request);
    const res   = await request.get(`/api/soal/${ujianId}`);
    expect(res.status()).toBe(200);
    const soals = await res.json();
    expect(soals).toHaveLength(3);
    soals.forEach((s: { nomor: number }, i: number) => {
      expect(s.nomor).toBe(i + 1);
    });
  });

  test('soal_count di GET /api/ujian ikut terupdate', async ({ request }) => {
    await loginAsGuru(request);
    const meRes = await request.get('/api/auth/me');
    const me    = await meRes.json();
    const guruId = me.guru?.id;

    const listRes = await request.get(`/api/ujian?guruId=${guruId}`);
    const list    = await listRes.json();
    const found   = list.find((u: { id: string }) => u.id === ujianId);
    expect(found).toBeTruthy();
    expect(found.soal_count).toBe(3);
  });

  test('jawaban_benar ada untuk guru', async ({ request }) => {
    await loginAsGuru(request);
    const res   = await request.get(`/api/soal/${ujianId}`);
    const soals = await res.json();
    soals.forEach((s: Record<string, unknown>) => {
      expect(s).toHaveProperty('jawaban_benar');
    });
  });

  test('jawaban_benar tidak ada untuk siswa', async ({ request }) => {
    await loginAsSiswa(request);
    const res   = await request.get(`/api/soal/${ujianId}`);
    const soals = await res.json();
    soals.forEach((s: Record<string, unknown>) => {
      expect(s).not.toHaveProperty('jawaban_benar');
    });
  });
});

// ── 3. Edit soal (replace bulk) ───────────────────────────────────────────────
test.describe('Edit soal', () => {
  test('Ubah teks pertanyaan soal pertama', async ({ request }) => {
    await loginAsGuru(request);

    // Ambil soal yang ada
    const getRes = await request.get(`/api/soal/${ujianId}`);
    const soals: Array<Record<string, unknown>> = await getRes.json();

    // Update pertanyaan soal nomor 1
    const updated = soals.map(s => ({
      ...s,
      pertanyaan: s.nomor === 1 ? 'Pertanyaan A (diedit)' : s.pertanyaan,
    }));

    const postRes = await request.post(`/api/soal/${ujianId}`, {
      data: { soals: updated },
    });
    expect(postRes.status()).toBe(200);

    // Verifikasi
    const verRes  = await request.get(`/api/soal/${ujianId}`);
    const verSoals = await verRes.json();
    const soal1   = verSoals.find((s: { nomor: number }) => s.nomor === 1);
    expect(soal1.pertanyaan).toBe('Pertanyaan A (diedit)');
  });

  test('Ubah jawaban_benar soal kedua', async ({ request }) => {
    await loginAsGuru(request);

    const getRes = await request.get(`/api/soal/${ujianId}`);
    const soals: Array<Record<string, unknown>> = await getRes.json();

    const updated = soals.map(s => ({
      ...s,
      jawaban_benar: s.nomor === 2 ? 'D' : s.jawaban_benar,
    }));

    await request.post(`/api/soal/${ujianId}`, { data: { soals: updated } });

    const verRes  = await request.get(`/api/soal/${ujianId}`);
    const verSoals = await verRes.json();
    const soal2   = verSoals.find((s: { nomor: number }) => s.nomor === 2);
    expect(soal2.jawaban_benar).toBe('D');
  });

  test('Ubah bobot soal ketiga', async ({ request }) => {
    await loginAsGuru(request);

    const getRes = await request.get(`/api/soal/${ujianId}`);
    const soals: Array<Record<string, unknown>> = await getRes.json();

    const updated = soals.map(s => ({
      ...s,
      bobot: s.nomor === 3 ? 5 : s.bobot,
    }));

    await request.post(`/api/soal/${ujianId}`, { data: { soals: updated } });

    const verRes  = await request.get(`/api/soal/${ujianId}`);
    const verSoals = await verRes.json();
    const soal3   = verSoals.find((s: { nomor: number | string }) => Number(s.nomor) === 3);
    expect(Number(soal3.bobot)).toBe(5);
  });

  test('Update ujian meta (nama, durasi) via PUT /api/ujian/[id]', async ({ request }) => {
    await loginAsGuru(request);

    const res = await request.put(`/api/ujian/${ujianId}`, {
      data: { nama_ujian: 'Manage Soal Test (updated)', durasi: 120 },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).ok).toBe(true);

    const getRes = await request.get(`/api/ujian/${ujianId}`);
    const ujian  = await getRes.json();
    expect(ujian.nama_ujian).toBe('Manage Soal Test (updated)');
    expect(Number(ujian.durasi)).toBe(120);
  });
});

// ── 4. Nomor urut soal ────────────────────────────────────────────────────────
test.describe('Nomor urut soal', () => {
  test('Soal diurutkan berdasarkan nomor ASC', async ({ request }) => {
    await loginAsGuru(request);

    // Submit dengan urutan terbalik
    const reversed = [
      { nomor: 3, pertanyaan: 'C', opsi_a: 'x', opsi_b: 'y', opsi_c: 'z', opsi_d: 'w', jawaban_benar: 'A', bobot: 1 },
      { nomor: 1, pertanyaan: 'A', opsi_a: 'x', opsi_b: 'y', opsi_c: 'z', opsi_d: 'w', jawaban_benar: 'B', bobot: 1 },
      { nomor: 2, pertanyaan: 'B', opsi_a: 'x', opsi_b: 'y', opsi_c: 'z', opsi_d: 'w', jawaban_benar: 'C', bobot: 1 },
    ];

    await request.post(`/api/soal/${ujianId}`, { data: { soals: reversed } });

    const res   = await request.get(`/api/soal/${ujianId}`);
    const soals = await res.json();

    // Harus dikembalikan urut 1, 2, 3
    expect(Number(soals[0].nomor)).toBe(1);
    expect(Number(soals[1].nomor)).toBe(2);
    expect(Number(soals[2].nomor)).toBe(3);
  });

  test('Tambah soal baru (jumlah jadi 5)', async ({ request }) => {
    await loginAsGuru(request);

    const getRes = await request.get(`/api/soal/${ujianId}`);
    const existing: Array<Record<string, unknown>> = await getRes.json();

    const withNew = [
      ...existing,
      { nomor: 4, pertanyaan: 'D', opsi_a: 'x', opsi_b: 'y', opsi_c: 'z', opsi_d: 'w', jawaban_benar: 'D', bobot: 1 },
      { nomor: 5, pertanyaan: 'E', opsi_a: 'x', opsi_b: 'y', opsi_c: 'z', opsi_d: 'w', jawaban_benar: 'A', bobot: 1 },
    ];

    await request.post(`/api/soal/${ujianId}`, { data: { soals: withNew } });

    const verRes = await request.get(`/api/soal/${ujianId}`);
    const soals  = await verRes.json();
    expect(soals).toHaveLength(5);
  });

  test('Hapus satu soal (kirim ulang tanpa soal nomor 5)', async ({ request }) => {
    await loginAsGuru(request);

    const getRes = await request.get(`/api/soal/${ujianId}`);
    const existing: Array<Record<string, unknown>> = await getRes.json();

    // Hapus soal terakhir
    const without5 = existing.filter(s => s.nomor !== 5);
    await request.post(`/api/soal/${ujianId}`, { data: { soals: without5 } });

    const verRes = await request.get(`/api/soal/${ujianId}`);
    const soals  = await verRes.json();
    expect(soals).toHaveLength(4);
    expect(soals.find((s: { nomor: number }) => s.nomor === 5)).toBeUndefined();
  });

  test('Replace semua soal dengan set baru — soal lama hilang', async ({ request }) => {
    await loginAsGuru(request);

    const newSoals = [
      { nomor: 1, pertanyaan: 'Baru satu', opsi_a: 'a', opsi_b: 'b', opsi_c: 'c', opsi_d: 'd', jawaban_benar: 'A', bobot: 1 },
      { nomor: 2, pertanyaan: 'Baru dua',  opsi_a: 'a', opsi_b: 'b', opsi_c: 'c', opsi_d: 'd', jawaban_benar: 'B', bobot: 1 },
    ];

    await request.post(`/api/soal/${ujianId}`, { data: { soals: newSoals } });

    const verRes = await request.get(`/api/soal/${ujianId}`);
    const soals  = await verRes.json();
    expect(soals).toHaveLength(2);
    expect(soals[0].pertanyaan).toBe('Baru satu');
    expect(soals[1].pertanyaan).toBe('Baru dua');
  });
});

// ── 5. Validasi akses (authorization) ────────────────────────────────────────
test.describe('Kontrol akses manage soal', () => {
  test('Siswa tidak bisa POST soal → 403', async ({ request }) => {
    await loginAsSiswa(request);
    const res = await request.post(`/api/soal/${ujianId}`, {
      data: { soals: SOAL_AWAL },
    });
    expect(res.status()).toBe(403);
  });

  test('Proktor bisa POST soal → 200', async ({ request }) => {
    await loginAsProktor(request);
    const res = await request.post(`/api/soal/${ujianId}`, {
      data: { soals: SOAL_AWAL },
    });
    expect(res.status()).toBe(200);
  });

  test('Guru lain (akun siswa role) tidak bisa edit soal ujian milik guru ini → 403', async ({ request }) => {
    // 111009 adalah siswa, bukan guru — role check akan menolak
    await loginAs(request, '111009', '111009@umbk');
    const res = await request.post(`/api/soal/${ujianId}`, {
      data: { soals: SOAL_AWAL },
    });
    expect(res.status()).toBe(403);
  });

  test('Tanpa login tidak bisa GET soal → 401', async ({ playwright }) => {
    // Gunakan context baru tanpa cookies agar benar-benar unauthenticated
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.get(`/api/soal/${ujianId}`);
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test('Tanpa login tidak bisa POST soal → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.post(`/api/soal/${ujianId}`, {
      data: { soals: SOAL_AWAL },
    });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });
});

// ── 6. Ujian dengan jadwal aktif tidak bisa dihapus ───────────────────────────
test.describe('Proteksi delete ujian', () => {
  test('DELETE ujian yang punya jadwal Published → 409', async ({ request }) => {
    await loginAsGuru(request);

    // Buat ujian baru
    const ujianRes = await request.post('/api/ujian', {
      data: { nama_ujian: 'Ujian Proteksi Delete', jenis_ujian: 'PTS', durasi: 60 },
    });
    const ujian = await ujianRes.json();

    // Proktor buat jadwal Published
    await loginAsProktor(request);
    const jadwalRes = await request.post('/api/jadwal', {
      data: { id_ujian: ujian.id, durasi_menit: 60, status_publikasi: 'Published' },
    });
    const jadwal = await jadwalRes.json();

    // Coba hapus ujian — harus ditolak
    await loginAsGuru(request);
    const delRes = await request.delete(`/api/ujian/${ujian.id}`);
    expect(delRes.status()).toBe(409);
    const body = await delRes.json();
    expect(body.error).toContain('jadwal aktif');

    // Cleanup: unpublish jadwal dulu baru hapus
    await loginAsProktor(request);
    await request.put(`/api/jadwal/${jadwal.id}`, {
      data: { status_publikasi: 'Draft' },
    });
    await request.delete(`/api/jadwal/${jadwal.id}`);
    await loginAsGuru(request);
    await request.delete(`/api/ujian/${ujian.id}`);
  });
});

// ── 7. Teardown ───────────────────────────────────────────────────────────────
test.describe('Teardown', () => {
  test('Hapus ujian test', async ({ request }) => {
    await loginAsGuru(request);
    if (ujianId) {
      const res = await request.delete(`/api/ujian/${ujianId}`);
      expect(res.status()).toBe(200);
    }
  });
});
