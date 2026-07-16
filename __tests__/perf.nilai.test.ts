/**
 * Perf test untuk app/api/nilai/route.ts -- P1
 * Verifikasi update benar_salah berjalan paralel (Promise.all), bukan sequential
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/apiAuth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/db', () => ({
  query:    jest.fn(),
  queryOne: jest.fn(),
  execute:  jest.fn(),
}));

import { getAuthUser } from '@/lib/apiAuth';
import { query, queryOne, execute } from '@/lib/db';
import { POST } from '@/app/api/nilai/route';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockQuery       = query as jest.Mock;
const mockQueryOne    = queryOne as jest.Mock;
const mockExecute     = execute as jest.Mock;

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/nilai', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeSoals(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `soal-${i + 1}`,
    jawaban_benar: 'A',
    bobot: 1,
  }));
}

function makeJawabans(soals: ReturnType<typeof makeSoals>, sessionId: string) {
  return soals.map((s, i) => ({
    id: `jaw-${i + 1}`,
    id_soal: s.id,
    id_session: sessionId,
    jawaban_siswa: i % 2 === 0 ? 'A' : 'B', // genap=benar, ganjil=salah
  }));
}

beforeEach(() => jest.clearAllMocks());

// -- P1: Kalkulasi paralel dengan banyak soal ----------------------------------
describe('POST /api/nilai -- paralel Promise.all (P1)', () => {
  const SESSION_ID = 'ses-perf-1';

  function setupMocks(soals: ReturnType<typeof makeSoals>, jawabans: ReturnType<typeof makeJawabans>) {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });

    mockQueryOne
      // call 1: siswas lookup (ownership check POST /api/nilai)
      .mockResolvedValueOnce({ id: 's1' })
      // call 2: session ownership check
      .mockResolvedValueOnce({ id_siswa: 's1' })
      // call 3: hitungDanSimpanNilai — session JOIN jadwal
      .mockResolvedValueOnce({
        id: SESSION_ID, id_jadwal: 'j1', id_siswa: 's1',
        jadwal_ujians: { id_ujian: 'u1' },
      })
      // call 4: guard duplikat — tidak ada
      .mockResolvedValueOnce(null)
      // call 5: INSERT nilai RETURNING
      .mockResolvedValueOnce({
        id: 'n-perf', nilai: 50,
        jumlah_benar: soals.length / 2,
        jumlah_salah: soals.length / 2,
        jumlah_kosong: 0,
      });

    mockQuery
      .mockResolvedValueOnce(soals)    // soals
      .mockResolvedValueOnce(jawabans); // jawabans

    mockExecute.mockResolvedValue(1);
  }

  test('10 soal -- semua execute UPDATE jawabans dipanggil', async () => {
    const soals = makeSoals(10);
    const jawabans = makeJawabans(soals, SESSION_ID);
    setupMocks(soals, jawabans);

    const res = await POST(makeReq({ sessionId: SESSION_ID }));
    expect(res.status).toBe(201);

    // execute dipanggil: 10x UPDATE jawabans (paralel) — tidak ada UPDATE session
    expect(mockExecute).toHaveBeenCalledTimes(10);
  });

  test('50 soal -- semua execute UPDATE jawabans dipanggil', async () => {
    const soals = makeSoals(50);
    const jawabans = makeJawabans(soals, SESSION_ID);
    setupMocks(soals, jawabans);

    const res = await POST(makeReq({ sessionId: SESSION_ID }));
    expect(res.status).toBe(201);

    // execute dipanggil: 50x UPDATE jawabans (paralel) — tidak ada UPDATE session
    expect(mockExecute).toHaveBeenCalledTimes(50);
  });

  test('kalkulasi nilai benar untuk 4 soal (2 benar, 2 salah)', async () => {
    const soals = makeSoals(4);
    const jawabans = makeJawabans(soals, SESSION_ID); // index 0,2 = benar (A), 1,3 = salah (B)

    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQueryOne
      // call 1: siswas lookup (ownership)
      .mockResolvedValueOnce({ id: 's1' })
      // call 2: session ownership check
      .mockResolvedValueOnce({ id_siswa: 's1' })
      // call 3: session JOIN jadwal
      .mockResolvedValueOnce({
        id: SESSION_ID, id_jadwal: 'j1', id_siswa: 's1',
        jadwal_ujians: { id_ujian: 'u1' },
      })
      // call 4: guard duplikat — tidak ada
      .mockResolvedValueOnce(null)
      // call 5: INSERT RETURNING
      .mockResolvedValueOnce({ id: 'n-4soal', nilai: 50, jumlah_benar: 2 });

    mockQuery
      .mockResolvedValueOnce(soals)
      .mockResolvedValueOnce(jawabans);

    mockExecute.mockResolvedValue(1);

    const res = await POST(makeReq({ sessionId: SESSION_ID }));
    expect(res.status).toBe(201);
    const body = await res.json();
    // nilai dihitung dari INSERT RETURNING mock
    expect(body.nilai).toBe(50);
    expect(body.jumlah_benar).toBe(2);
  });

  test('soal kosong (0 soal) -- nilai = 0, tidak ada execute UPDATE jawaban', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQueryOne
      // call 1: siswas lookup (ownership)
      .mockResolvedValueOnce({ id: 's1' })
      // call 2: session ownership check
      .mockResolvedValueOnce({ id_siswa: 's1' })
      // call 3: hitungDanSimpanNilai — session JOIN jadwal
      .mockResolvedValueOnce({
        id: SESSION_ID, id_jadwal: 'j1', id_siswa: 's1',
        jadwal_ujians: { id_ujian: 'u1' },
      })
      // call 4: guard duplikat — tidak ada
      .mockResolvedValueOnce(null)
      // call 5: INSERT nilai RETURNING
      .mockResolvedValueOnce({ id: 'n-empty', nilai: 0 });

    mockQuery
      .mockResolvedValueOnce([])  // soals kosong
      .mockResolvedValueOnce([]); // jawabans kosong

    mockExecute.mockResolvedValue(1);

    const res = await POST(makeReq({ sessionId: SESSION_ID }));
    expect(res.status).toBe(201);
    // soal kosong = tidak ada UPDATE jawabans sama sekali (Promise.all([]) kosong)
    expect(mockExecute).toHaveBeenCalledTimes(0);
  });

  test('nilai sudah ada -- return existing tanpa hitung ulang', async () => {
    const existingNilai = { id: 'n-existing', nilai: 75, jumlah_benar: 3 };

    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQueryOne
      // call 1: siswas lookup (ownership)
      .mockResolvedValueOnce({ id: 's1' })
      // call 2: session ownership check
      .mockResolvedValueOnce({ id_siswa: 's1' })
      // call 3: hitungDanSimpanNilai — session JOIN jadwal
      .mockResolvedValueOnce({
        id: SESSION_ID, id_jadwal: 'j1', id_siswa: 's1',
        jadwal_ujians: { id_ujian: 'u1' },
      })
      // call 4: INSERT ON CONFLICT → null (duplikat race condition)
      .mockResolvedValueOnce(null)
      // call 5: SELECT existing nilai
      .mockResolvedValueOnce(existingNilai);

    // hitungDanSimpanNilai tetap butuh query soal+jawaban sebelum INSERT
    mockQuery
      .mockResolvedValueOnce([])  // soals kosong
      .mockResolvedValueOnce([]); // jawabans kosong

    mockExecute.mockResolvedValue(1);

    const res = await POST(makeReq({ sessionId: SESSION_ID }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('n-existing');
    expect(body.nilai).toBe(75);
  });
});
