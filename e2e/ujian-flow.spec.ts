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
const loginAsProktor  = (r: APIRequestContext) => loginAs(r, 'proktor1', 'ecbtmtswaha');
const loginAsSiswa    = (r: APIRequestContext) => loginAs(r, '240006', '240006@umbk');

// 5 soal: 3 benar kalau jawab A,B,C,D,A → nomor 1,2,3 benar, 4,5 salah
// jawaban_benar: A,B,C,D,A  — siswa jawab: A,B,C,A,B → benar 3, salah 2, nilai 60
const SOALS = [
  { nomor: 1, pertanyaan: 'Soal satu?',  opsi_a: 'Benar', opsi_b: 'Salah', opsi_c: 'Salah', opsi_d: 'Salah', jawaban_benar: 'A', bobot: 1 },
  { nomor: 2, pertanyaan: 'Soal dua?',  opsi_a: 'Salah', opsi_b: 'Benar', opsi_c: 'Salah', opsi_d: 'Salah', jawaban_benar: 'B', bobot: 1 },
  { nomor: 3, pertanyaan: 'Soal tiga?', opsi_a: 'Salah', opsi_b: 'Salah', opsi_c: 'Benar', opsi_d: 'Salah', jawaban_benar: 'C', bobot: 1 },
  { nomor: 4, pertanyaan: 'Soal empat?',opsi_a: 'Salah', opsi_b: 'Salah', opsi_c: 'Salah', opsi_d: 'Benar', jawaban_benar: 'D', bobot: 1 },
  { nomor: 5, pertanyaan: 'Soal lima?', opsi_a: 'Benar', opsi_b: 'Salah', opsi_c: 'Salah', opsi_d: 'Salah', jawaban_benar: 'A', bobot: 1 },
];
// Siswa menjawab: soal 1→A(✓), 2→B(✓), 3→C(✓), 4→A(✗), 5→B(✗)
const JAWABAN_SISWA: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C', 4: 'A', 5: 'B' };

// ── Shared state yang dipakai lintas describe ─────────────────────────────────
let ujianId  = '';
let jadwalId = '';
let siswaId  = '';
let sessionId = '';

// ── 1. Setup: guru buat ujian + soal, proktor buat jadwal ─────────────────────
test.describe('Setup ujian flow', () => {
  test('Guru buat ujian dengan 5 soal', async ({ request }) => {
    await loginAsGuru(request);

    const ujianRes = await request.post('/api/ujian', {
      data: {
        nama_ujian : 'Ujian E2E Flow Test',
        jenis_ujian: 'LATIHAN',
        durasi     : 90,
        acak_soal  : false,   // urutan tetap agar mudah diverifikasi
        acak_opsi  : false,
        tampil_hasil: true,
      },
    });
    expect(ujianRes.status()).toBe(201);
    const ujian = await ujianRes.json();
    ujianId = ujian.id;
    expect(ujianId).toBeTruthy();

    // Simpan 5 soal
    const soalRes = await request.post(`/api/soal/${ujianId}`, {
      data: { soals: SOALS },
    });
    expect(soalRes.status()).toBe(200);
    expect((await soalRes.json()).ok).toBe(true);

    // Verifikasi soal tersimpan
    const getRes = await request.get(`/api/soal/${ujianId}`);
    const soals  = await getRes.json();
    expect(soals).toHaveLength(5);
    // Urutan nomor harus 1..5
    soals.forEach((s: { nomor: number | string }, i: number) => {
      expect(Number(s.nomor)).toBe(i + 1);
    });
  });

  test('Proktor buat jadwal Published untuk ujian tersebut', async ({ request }) => {
    expect(ujianId).toBeTruthy();

    // Ambil siswaId dari /api/auth/me sebagai siswa
    await loginAsSiswa(request);
    const meRes = await request.get('/api/auth/me');
    const me    = await meRes.json();
    siswaId     = me.siswa?.id;
    expect(siswaId).toBeTruthy();

    // Proktor buat jadwal dan masukkan siswa
    await loginAsProktor(request);
    const jadwalRes = await request.post('/api/jadwal', {
      data: {
        id_ujian        : ujianId,
        durasi_menit    : 90,
        status_publikasi: 'Published',
        siswa_ids       : [siswaId],
      },
    });
    expect(jadwalRes.status()).toBe(201);
    const jadwal = await jadwalRes.json();
    jadwalId     = jadwal.id;
    expect(jadwalId).toBeTruthy();
  });
});

// ── 2. Siswa lihat jadwal yang tersedia ───────────────────────────────────────
test.describe('Siswa melihat jadwal', () => {
  test('GET /api/jadwal?siswaId mengembalikan jadwal Published yang memuat siswa', async ({ request }) => {
    expect(siswaId).toBeTruthy();
    await loginAsSiswa(request);

    const res  = await request.get(`/api/jadwal?siswaId=${siswaId}`);
    expect(res.status()).toBe(200);
    const list = await res.json();

    const found = list.find((j: { id: string }) => j.id === jadwalId);
    expect(found).toBeTruthy();
    expect(found.status_publikasi).toBe('Published');
  });

  test('Jadwal Draft tidak tampil untuk siswa', async ({ request }) => {
    await loginAsProktor(request);
    // Buat jadwal Draft terpisah
    const draftRes = await request.post('/api/jadwal', {
      data: { id_ujian: ujianId, durasi_menit: 60, status_publikasi: 'Draft', siswa_ids: [siswaId] },
    });
    const draft = await draftRes.json();

    await loginAsSiswa(request);
    const listRes = await request.get(`/api/jadwal?siswaId=${siswaId}`);
    const list    = await listRes.json();
    const found   = list.find((j: { id: string }) => j.id === draft.id);
    expect(found).toBeUndefined();

    // Cleanup jadwal Draft
    await loginAsProktor(request);
    await request.delete(`/api/jadwal/${draft.id}`);
  });
});

// ── 3. Siswa mulai ujian (buat session) ───────────────────────────────────────
test.describe('Siswa mulai ujian', () => {
  test('POST /api/session buat session berlangsung', async ({ request }) => {
    expect(siswaId).toBeTruthy();
    expect(jadwalId).toBeTruthy();
    await loginAsSiswa(request);

    const res = await request.post('/api/session', {
      data: { siswaId, jadwalId },
    });
    // 201 jika baru, 200 jika sudah ada
    expect([200, 201]).toContain(res.status());
    const sess  = await res.json();
    sessionId   = sess.id;
    expect(sessionId).toBeTruthy();
    expect(sess.status).toBe('berlangsung');
    expect(sess.id_siswa).toBe(siswaId);
    expect(sess.id_jadwal).toBe(jadwalId);
  });

  test('POST /api/session idempoten — session kedua mengembalikan session yang sama', async ({ request }) => {
    await loginAsSiswa(request);
    const res  = await request.post('/api/session', { data: { siswaId, jadwalId } });
    expect(res.status()).toBe(200);
    const sess = await res.json();
    expect(sess.id).toBe(sessionId);   // harus ID yang sama
  });

  test('GET /api/session?siswaId&jadwalId mengembalikan session', async ({ request }) => {
    await loginAsSiswa(request);
    const res  = await request.get(`/api/session?siswaId=${siswaId}&jadwalId=${jadwalId}`);
    expect(res.status()).toBe(200);
    const sess = await res.json();
    expect(sess.id).toBe(sessionId);
  });

  test('Siswa lain tidak bisa melihat session siswa ini', async ({ request }) => {
    // Login sebagai siswa lain (240007) — bukan pemilik session ini (240006)
    await loginAs(request, '240007', '240007@umbk');
    const res = await request.get(`/api/session?siswaId=${siswaId}&jadwalId=${jadwalId}`);
    // Siswa lain → 403
    expect(res.status()).toBe(403);
  });
});

// ── 4. Siswa mengerjakan soal (upsert jawaban) ────────────────────────────────
test.describe('Siswa menjawab soal', () => {
  test('GET /api/soal/[ujianId] sebagai siswa tidak mengandung jawaban_benar', async ({ request }) => {
    await loginAsSiswa(request);
    const res  = await request.get(`/api/soal/${ujianId}`);
    expect(res.status()).toBe(200);
    const soals = await res.json();
    expect(soals.length).toBe(5);
    soals.forEach((s: Record<string, unknown>) => {
      expect(s).not.toHaveProperty('jawaban_benar');
    });
  });

  test('POST /api/jawaban upsert jawaban untuk semua soal', async ({ request }) => {
    await loginAsSiswa(request);

    // Ambil daftar soal untuk dapat id-nya
    const soalRes = await loginAsGuru(request).then(() => request.get(`/api/soal/${ujianId}`));
    const soals: Array<{ id: string; nomor: number }> = await soalRes.json();

    // Login kembali sebagai siswa sebelum upsert
    await loginAsSiswa(request);

    for (const soal of soals) {
      const jawaban = JAWABAN_SISWA[soal.nomor];
      const res = await request.post('/api/jawaban', {
        data: {
          sessionId,
          soalId       : soal.id,
          jawaban_siswa: jawaban,
          status_soal  : 'sudah',
        },
      });
      expect(res.status()).toBe(200);
      expect((await res.json()).ok).toBe(true);
    }
  });

  test('GET /api/jawaban?sessionId mengembalikan semua jawaban yang disimpan', async ({ request }) => {
    await loginAsSiswa(request);
    const res     = await request.get(`/api/jawaban?sessionId=${sessionId}`);
    expect(res.status()).toBe(200);
    const jawabans = await res.json();
    expect(jawabans.length).toBe(5);
    // Semua harus punya jawaban_siswa
    jawabans.forEach((j: { jawaban_siswa: string | null }) => {
      expect(j.jawaban_siswa).not.toBeNull();
    });
  });

  test('POST /api/jawaban update (upsert) jawaban yang sudah ada', async ({ request }) => {
    await loginAsSiswa(request);

    // Ambil soal pertama
    await loginAsGuru(request);
    const soalRes = await request.get(`/api/soal/${ujianId}`);
    const soals: Array<{ id: string; nomor: number }> = await soalRes.json();
    const soal1 = soals.find(s => s.nomor === 1)!;

    // Siswa login lagi lalu ubah jawaban soal 1 ke 'D' (salah)
    await loginAsSiswa(request);
    const res = await request.post('/api/jawaban', {
      data: { sessionId, soalId: soal1.id, jawaban_siswa: 'D', status_soal: 'ragu' },
    });
    expect(res.status()).toBe(200);

    // Verifikasi jawaban terupdate
    const listRes  = await request.get(`/api/jawaban?sessionId=${sessionId}`);
    const jawabans = await listRes.json();
    const j1       = jawabans.find((j: { id_soal: string }) => j.id_soal === soal1.id);
    expect(j1.jawaban_siswa).toBe('D');
    expect(j1.status_soal).toBe('ragu');

    // Kembalikan ke jawaban benar (A) untuk test submit
    await request.post('/api/jawaban', {
      data: { sessionId, soalId: soal1.id, jawaban_siswa: 'A', status_soal: 'sudah' },
    });
  });
});

// ── 5. Siswa submit ujian dan cek hasil ───────────────────────────────────────
test.describe('Siswa submit ujian', () => {
  test('POST /api/nilai menghitung dan menyimpan nilai', async ({ request }) => {
    await loginAsSiswa(request);

    const res  = await request.post('/api/nilai', { data: { sessionId } });
    expect(res.status()).toBe(201);
    const hasil = await res.json();

    // 3 benar (soal 1,2,3), 2 salah (soal 4,5)
    expect(Number(hasil.jumlah_benar)).toBe(3);
    expect(Number(hasil.jumlah_salah)).toBe(2);
    expect(Number(hasil.jumlah_kosong)).toBe(0);
    expect(Number(hasil.nilai)).toBe(60);              // 3/5 * 100
    expect(hasil.id_session).toBe(sessionId);
    expect(hasil.id_siswa).toBe(siswaId);
  });

  test('Status session berubah menjadi selesai setelah submit', async ({ request }) => {
    await loginAsSiswa(request);
    const res  = await request.get(`/api/session?siswaId=${siswaId}&jadwalId=${jadwalId}`);
    const sess = await res.json();
    expect(sess.status).toBe('selesai');
  });

  test('POST /api/nilai idempoten — submit kedua mengembalikan nilai yang sama', async ({ request }) => {
    await loginAsSiswa(request);
    const res   = await request.post('/api/nilai', { data: { sessionId } });
    // Status bisa 201 atau 200 (ON CONFLICT DO NOTHING path)
    expect([200, 201]).toContain(res.status());
    const hasil = await res.json();
    expect(Number(hasil.nilai)).toBe(60);
  });

  test('GET /api/nilai?sessionId mengembalikan nilai yang tersimpan', async ({ request }) => {
    await loginAsSiswa(request);
    const res  = await request.get(`/api/nilai?sessionId=${sessionId}`);
    expect(res.status()).toBe(200);
    const hasil = await res.json();
    expect(Number(hasil.nilai)).toBe(60);
    expect(Number(hasil.jumlah_benar)).toBe(3);
  });

  test('GET /api/nilai?siswaId mengembalikan riwayat nilai siswa', async ({ request }) => {
    await loginAsSiswa(request);
    const res  = await request.get(`/api/nilai?siswaId=${siswaId}`);
    expect(res.status()).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    const found = list.find((n: { id_session: string }) => n.id_session === sessionId);
    expect(found).toBeTruthy();
    expect(Number(found.nilai)).toBe(60);
  });

  test('Siswa lain tidak bisa melihat nilai siswa ini', async ({ request }) => {
    await loginAs(request, '240007', '240007@umbk');
    // siswaId milik 240006, 240007 tidak boleh melihatnya
    const res = await request.get(`/api/nilai?siswaId=${siswaId}`);
    expect(res.status()).toBe(403);
  });
});

// ── 6. Proktor melihat hasil ujian ────────────────────────────────────────────
test.describe('Proktor melihat hasil', () => {
  test('GET /api/nilai?jadwalId mengembalikan semua nilai untuk jadwal tersebut', async ({ request }) => {
    await loginAsProktor(request);
    const res  = await request.get(`/api/nilai?jadwalId=${jadwalId}`);
    expect(res.status()).toBe(200);
    const list = await res.json();
    expect(Array.isArray(list)).toBe(true);
    const found = list.find((n: { id_session: string }) => n.id_session === sessionId);
    expect(found).toBeTruthy();
    expect(Number(found.nilai)).toBe(60);
  });

  test('GET /api/jawaban?sessionId sebagai proktor mengembalikan jawaban lengkap', async ({ request }) => {
    await loginAsProktor(request);
    const res     = await request.get(`/api/jawaban?sessionId=${sessionId}`);
    expect(res.status()).toBe(200);
    const jawabans = await res.json();
    expect(jawabans.length).toBe(5);
    // Setelah submit, benar_salah harus sudah diisi
    jawabans.forEach((j: { benar_salah: boolean | null }) => {
      expect(j.benar_salah).not.toBeNull();
    });
  });
});

// ── 7. Teardown: hapus ujian dan jadwal ───────────────────────────────────────
test.describe('Teardown', () => {
  test('Proktor hapus jadwal dan guru hapus ujian', async ({ request }) => {
    await loginAsProktor(request);
    if (jadwalId) {
      const r = await request.delete(`/api/jadwal/${jadwalId}`);
      expect(r.status()).toBe(200);
    }

    await loginAsGuru(request);
    if (ujianId) {
      const r = await request.delete(`/api/ujian/${ujianId}`);
      expect(r.status()).toBe(200);
    }
  });
});
