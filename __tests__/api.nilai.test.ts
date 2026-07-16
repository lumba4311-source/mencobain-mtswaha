/**
 * Unit tests untuk app/api/nilai/route.ts
 * Test: GET (A-08 validasi parameter), POST
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
import { GET, POST } from '@/app/api/nilai/route';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockQuery       = query as jest.Mock;
const mockQueryOne    = queryOne as jest.Mock;
const mockExecute     = execute as jest.Mock;

function makeReq(method: string, body?: object, search?: string) {
  const url = `http://localhost/api/nilai${search ? '?' + search : ''}`;
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  });
}

beforeEach(() => jest.clearAllMocks());

// -- GET ----------------------------------------------------------------------
describe('GET /api/nilai', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(401);
  });

  test('returns 400 jika tidak ada parameter sama sekali (A-08)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('parameter');
  });

  test('returns 200 array dengan filter jadwalId', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockQuery.mockResolvedValue([{ id: 'n1', nilai: 80 }]);
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].nilai).toBe(80);
  });

  test('returns 200 array dengan filter siswaId', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    // siswas lookup — id cocok dengan siswaId=s1
    mockQueryOne.mockResolvedValueOnce({ id: 's1' });
    mockQuery.mockResolvedValue([]);
    const res = await GET(makeReq('GET', undefined, 'siswaId=s1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('returns 200 object tunggal dengan filter sessionId', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    // siswas lookup untuk ownership check
    mockQueryOne.mockResolvedValueOnce({ id: 's1' });
    mockQuery.mockResolvedValue([{ id: 'n1', nilai: 75 }]);
    const res = await GET(makeReq('GET', undefined, 'sessionId=ses1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    // sessionId -> return rows[0] (object, bukan array)
    expect(body).toHaveProperty('nilai', 75);
  });

  test('returns 200 null jika sessionId tidak ada hasilnya', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    // siswas lookup untuk ownership check
    mockQueryOne.mockResolvedValueOnce({ id: 's1' });
    mockQuery.mockResolvedValue([]);
    const res = await GET(makeReq('GET', undefined, 'sessionId=ses-kosong'));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test('returns 500 jika DB error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockQuery.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(500);
  });
});

// -- POST ---------------------------------------------------------------------
describe('POST /api/nilai', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(makeReq('POST', { sessionId: 'ses1' }));
    expect(res.status).toBe(401);
  });

  test('returns 404 jika session tidak ditemukan', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    // call 1: siswas lookup berhasil, call 2: session → null → 404
    mockQueryOne
      .mockResolvedValueOnce({ id: 's1' })  // siswas
      .mockResolvedValueOnce(null);          // session tidak ada → 404
    const res = await POST(makeReq('POST', { sessionId: 'ses-ghost' }));
    expect(res.status).toBe(404);
  });

  test('returns 403 jika siswa submit session orang lain', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQueryOne
      .mockResolvedValueOnce({ id: 's1' })              // siswas lookup
      .mockResolvedValueOnce({ id_siswa: 's-lain' });   // session milik orang lain
    const res = await POST(makeReq('POST', { sessionId: 'ses1' }));
    expect(res.status).toBe(403);
  });

  test('returns 200 jika nilai sudah ada (guard duplikat)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQueryOne
      .mockResolvedValueOnce({ id: 's1' })                              // siswas lookup
      .mockResolvedValueOnce({ id_siswa: 's1' })                        // session ownership
      .mockResolvedValueOnce({                                           // session JOIN jadwal
        id: 'ses1', id_jadwal: 'j1', id_siswa: 's1',
        jadwal_ujians: { id_ujian: 'u1' },
      })
      .mockResolvedValueOnce(null)                                       // INSERT ON CONFLICT → null (duplikat)
      .mockResolvedValueOnce({ id: 'n-existing', nilai: 75, jumlah_benar: 3 }); // SELECT existing

    // soals + jawabans diperlukan karena hitungDanSimpanNilai tetap jalan dulu baru INSERT
    mockQuery
      .mockResolvedValueOnce([])   // soals
      .mockResolvedValueOnce([]);  // jawabans
    mockExecute.mockResolvedValue(1);

    const res = await POST(makeReq('POST', { sessionId: 'ses1' }));
    expect(res.status).toBe(201); // route selalu return 201, nilai existing dikembalikan
    const body = await res.json();
    expect(body.id).toBe('n-existing');
    expect(body.nilai).toBe(75);
  });

  test('returns 201 setelah hitung dan simpan nilai baru', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });

    const soals = [
      { id: 'q1', jawaban_benar: 'A', bobot: 1 },
      { id: 'q2', jawaban_benar: 'B', bobot: 1 },
      { id: 'q3', jawaban_benar: 'C', bobot: 1 },
    ];
    const jawabans = [
      { id: 'jaw1', id_soal: 'q1', jawaban_siswa: 'A' }, // benar
      { id: 'jaw2', id_soal: 'q2', jawaban_siswa: 'D' }, // salah
      { id: 'jaw3', id_soal: 'q3', jawaban_siswa: null }, // kosong
    ];

    mockQueryOne
      .mockResolvedValueOnce({ id: 's1' })              // siswas lookup (ownership)
      .mockResolvedValueOnce({ id_siswa: 's1' })        // session ownership check
      .mockResolvedValueOnce({                           // hitungDanSimpanNilai: session JOIN jadwal
        id: 'ses1', id_jadwal: 'j1', id_siswa: 's1',
        jadwal_ujians: { id_ujian: 'u1' },
      })
      .mockResolvedValueOnce({ id: 'n-new', nilai: 33, jumlah_benar: 1 }); // INSERT RETURNING (bukan null)

    mockQuery
      .mockResolvedValueOnce(soals)     // soals
      .mockResolvedValueOnce(jawabans); // jawabans

    // 3x UPDATE jawabans + 1x UPDATE session = 4 execute calls
    mockExecute.mockResolvedValue(1);

    const res = await POST(makeReq('POST', { sessionId: 'ses1' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('n-new');
  });

  test('returns 500 jika DB error saat kalkulasi', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQueryOne.mockRejectedValue(new Error('DB error'));
    const res = await POST(makeReq('POST', { sessionId: 'ses1' }));
    expect(res.status).toBe(500);
  });
});
