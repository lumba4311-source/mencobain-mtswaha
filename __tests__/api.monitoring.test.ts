/**
 * Unit tests untuk app/api/monitoring/route.ts
 * Test: GET (A-06), POST (force-submit)
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/apiAuth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/db', () => ({
  query:    jest.fn(),
  queryOne: jest.fn(),
  execute:  jest.fn(),
}));
// monitoring/route.ts memanggil hitungDanSimpanNilai dari nilai/route.ts secara langsung
// mock seluruh nilai/route agar force-submit test tidak bergantung pada logika nilai
jest.mock('@/app/api/nilai/route', () => ({
  hitungDanSimpanNilai: jest.fn(),
  POST: jest.fn(),
  GET:  jest.fn(),
}));

import { getAuthUser } from '@/lib/apiAuth';
import { query, queryOne, execute } from '@/lib/db';
import { hitungDanSimpanNilai as mockHitungDanSimpanNilai } from '@/app/api/nilai/route';
import { GET, POST } from '@/app/api/monitoring/route';

const mockGetAuthUser         = getAuthUser as jest.Mock;
const mockQuery               = query as jest.Mock;
const mockQueryOne            = queryOne as jest.Mock;
const mockExecute             = execute as jest.Mock;
const mockHitung              = mockHitungDanSimpanNilai as jest.Mock;

function makeReq(method: string, body?: object, search?: string) {
  const url = `http://localhost/api/monitoring${search ? '?' + search : ''}`;
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  });
}

beforeEach(() => jest.clearAllMocks());

// ── GET ──────────────────────────────────────────────────────────────────────
describe('GET /api/monitoring', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(401);
  });

  test('returns 403 jika role guru', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(403);
  });

  test('returns 403 jika role siswa', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(403);
  });

  test('returns 400 jika jadwalId tidak ada', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('jadwalId');
  });

  test('returns 404 jika jadwal tidak ditemukan', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockQueryOne.mockResolvedValue(null);
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(404);
  });

  test('returns 200 array kosong jika tidak ada siswa di jadwal', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockQueryOne.mockResolvedValue({ id: 'j1', id_ujian: 'u1', ujians: { durasi: 90 } });
    mockQuery.mockResolvedValue([]); // jadwal_siswa kosong
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([]);
  });

  test('returns 200 dengan data monitoring siswa', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    // queryOne: (1) jadwal lookup saja — tidak ada totalSoal queryOne di route
    mockQueryOne
      .mockResolvedValueOnce({ id: 'j1', id_ujian: 'u1', ujians: { durasi: 90 } });
    mockQuery
      // jadwal_siswa
      .mockResolvedValueOnce([{ siswa_id: 's1' }, { siswa_id: 's2' }])
      // siswas
      .mockResolvedValueOnce([
        { id: 's1', nama: 'Siswa Satu', nis: '001', id_kelas: 'k1' },
        { id: 's2', nama: 'Siswa Dua', nis: '002', id_kelas: 'k1' },
      ])
      // sessions
      .mockResolvedValueOnce([
        { id: 'ses1', id_siswa: 's1', id_jadwal: 'j1', status: 'berlangsung', sisa_waktu: 3600, deadline: null, started_at: null },
      ])
      // jawabans
      .mockResolvedValueOnce([
        { id_session: 'ses1' },
        { id_session: 'ses1' },
        { id_session: 'ses1' },
      ]);

    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(2);
    // response shape: { siswa, session, jumlah_dijawab, progress_persen, status }
    const s1 = body.find((x: { siswa: { id: string } }) => x.siswa.id === 's1');
    expect(s1).toBeDefined();
    expect(s1.jumlahDijawab).toBe(3);
    expect(s1.status).toBe('berlangsung');
    // siswa tanpa session harus status belum_masuk
    const s2 = body.find((x: { siswa: { id: string } }) => x.siswa.id === 's2');
    expect(s2.status).toBe('Belum Ujian');
    expect(s2.sessionId).toBeNull();
  });

  test('returns 500 jika DB error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockQueryOne.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(500);
  });
});

// ── POST (force-submit, A-06) ─────────────────────────────────────────────────
describe('POST /api/monitoring (force-submit, A-06)', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(makeReq('POST', { sessionId: 'ses1' }));
    expect(res.status).toBe(401);
  });

  test('returns 403 jika bukan proktor/admin', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await POST(makeReq('POST', { sessionId: 'ses1' }));
    expect(res.status).toBe(403);
  });

  test('returns 400 jika sessionId tidak ada (A-06 circuit breaker)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const res = await POST(makeReq('POST', {}));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('sessionId');
  });

  test('force-submit berhasil — execute UPDATE + panggil hitungDanSimpanNilai', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    // queryOne: session lookup untuk cek status sebelum force submit
    mockQueryOne.mockResolvedValueOnce({ id: 'ses1', id_jadwal: 'j1', status: 'berlangsung' });
    mockExecute.mockResolvedValue(1);
    // mock hitungDanSimpanNilai langsung — bukan POST
    mockHitung.mockResolvedValue({ id: 'n1', nilai: 80 });

    const res = await POST(makeReq('POST', { sessionId: 'ses1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.nilai).toBeDefined();
    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining('force_submit'),
      ['ses1']
    );
    expect(mockHitung).toHaveBeenCalledWith('ses1');
  });
});
