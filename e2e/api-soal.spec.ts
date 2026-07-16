import { test, expect, type APIRequestContext } from '@playwright/test';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function loginAs(request: APIRequestContext, username: string, password: string) {
  const res = await request.post('/api/auth/login', { data: { username, password } });
  expect(res.status()).toBe(200);
  return res;
}

const SOALS_WITH_ANSWERS = [
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

// ── Setup: buat ujian + soal sebagai guru, kembalikan ujianId ─────────────────
async function setupUjianDenganSoal(request: APIRequestContext): Promise<string> {
  await loginAs(request, '102008', '102008@umbk');

  const ujianRes = await request.post('/api/ujian', {
    data: { nama_ujian: 'Ujian Strip Test', jenis_ujian: 'LATIHAN', durasi: 90 },
  });
  expect(ujianRes.status()).toBe(201);
  const ujian = await ujianRes.json();

  const soalRes = await request.post(`/api/soal/${ujian.id}`, {
    data: { soals: SOALS_WITH_ANSWERS },
  });
  expect(soalRes.status()).toBe(200);

  return ujian.id as string;
}

// ── 1. Siswa TIDAK mendapat jawaban_benar ─────────────────────────────────────
test('API Soal — siswa GET soal: jawaban_benar tidak ada dalam response', async ({ request }) => {
  const ujianId = await setupUjianDenganSoal(request);

  try {
    // Login sebagai siswa
    await loginAs(request, '240006', '240006@umbk');

    const res = await request.get(`/api/soal/${ujianId}`);
    expect(res.status()).toBe(200);
    const soals = await res.json();

    expect(soals.length).toBe(SOALS_WITH_ANSWERS.length);

    // Setiap soal TIDAK boleh memiliki property jawaban_benar
    for (const soal of soals) {
      expect(Object.keys(soal)).not.toContain('jawaban_benar');
    }
  } finally {
    await loginAs(request, '102008', '102008@umbk');
    await request.delete(`/api/ujian/${ujianId}`);
  }
});

// ── 2. Guru MENDAPAT jawaban_benar ────────────────────────────────────────────
test('API Soal — guru GET soal: jawaban_benar ada dalam response', async ({ request }) => {
  const ujianId = await setupUjianDenganSoal(request);

  try {
    await loginAs(request, '102008', '102008@umbk');

    const res = await request.get(`/api/soal/${ujianId}`);
    expect(res.status()).toBe(200);
    const soals = await res.json();

    expect(soals.length).toBe(SOALS_WITH_ANSWERS.length);

    // Setiap soal HARUS memiliki jawaban_benar
    for (const soal of soals) {
      expect(Object.keys(soal)).toContain('jawaban_benar');
      expect(['A', 'B', 'C', 'D']).toContain(soal.jawaban_benar);
    }
  } finally {
    await request.delete(`/api/ujian/${ujianId}`);
  }
});

// ── 3. Proktor MENDAPAT jawaban_benar ─────────────────────────────────────────
test('API Soal — proktor GET soal: jawaban_benar ada dalam response', async ({ request }) => {
  const ujianId = await setupUjianDenganSoal(request);

  try {
    await loginAs(request, 'proktor1', 'ecbtmtswaha');

    const res = await request.get(`/api/soal/${ujianId}`);
    expect(res.status()).toBe(200);
    const soals = await res.json();

    expect(soals.length).toBe(SOALS_WITH_ANSWERS.length);

    for (const soal of soals) {
      expect(Object.keys(soal)).toContain('jawaban_benar');
    }
  } finally {
    await loginAs(request, '102008', '102008@umbk');
    await request.delete(`/api/ujian/${ujianId}`);
  }
});

// ── 4. Semua siswa seed mendapat soal tanpa jawaban_benar ─────────────────────
const SISWA_USERS = [
  { username: '240006', password: '240006@umbk' },
  { username: '240007', password: '240007@umbk' },
  { username: '240008', password: '240008@umbk' },
];

for (const siswa of SISWA_USERS) {
  test(`API Soal — siswa ${siswa.username}: jawaban_benar di-strip`, async ({ request }) => {
    const ujianId = await setupUjianDenganSoal(request);

    try {
      await loginAs(request, siswa.username, siswa.password);

      const res = await request.get(`/api/soal/${ujianId}`);
      expect(res.status()).toBe(200);
      const soals = await res.json();

      // Tidak ada satu pun soal yang bocorkan jawaban_benar
      for (const soal of soals) {
        expect(Object.keys(soal)).not.toContain('jawaban_benar');
      }
      // Tapi field lain tetap ada
      for (const soal of soals) {
        expect(soal).toHaveProperty('pertanyaan');
        expect(soal).toHaveProperty('opsi_a');
        expect(soal).toHaveProperty('opsi_b');
        expect(soal).toHaveProperty('opsi_c');
        expect(soal).toHaveProperty('opsi_d');
        expect(soal).toHaveProperty('nomor');
      }
    } finally {
      await loginAs(request, '102008', '102008@umbk');
      await request.delete(`/api/ujian/${ujianId}`);
    }
  });
}

// ── 5. Tanpa auth → 401 ───────────────────────────────────────────────────────
test('API Soal — tanpa auth GET /api/soal/[id] → 401', async ({ request }) => {
  const res = await request.get('/api/soal/nonexistent-id');
  expect(res.status()).toBe(401);
});

// ── 6. Siswa tidak boleh POST soal → 403 ─────────────────────────────────────
test('API Soal — siswa POST /api/soal/[id] → 403', async ({ request }) => {
  const ujianId = await setupUjianDenganSoal(request);

  try {
    await loginAs(request, '240006', '240006@umbk');

    const res = await request.post(`/api/soal/${ujianId}`, {
      data: { soals: SOALS_WITH_ANSWERS },
    });
    expect(res.status()).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden.');
  } finally {
    await loginAs(request, '102008', '102008@umbk');
    await request.delete(`/api/ujian/${ujianId}`);
  }
});

// ── 7. Ujian kosong (0 soal) → array kosong ───────────────────────────────────
test('API Soal — ujian tanpa soal mengembalikan array kosong', async ({ request }) => {
  await loginAs(request, '102008', '102008@umbk');

  const ujianRes = await request.post('/api/ujian', {
    data: { nama_ujian: 'Ujian Kosong', jenis_ujian: 'LATIHAN', durasi: 90 },
  });
  const ujian = await ujianRes.json();

  try {
    const res = await request.get(`/api/soal/${ujian.id}`);
    expect(res.status()).toBe(200);
    const soals = await res.json();
    expect(Array.isArray(soals)).toBe(true);
    expect(soals.length).toBe(0);
  } finally {
    await request.delete(`/api/ujian/${ujian.id}`);
  }
});
