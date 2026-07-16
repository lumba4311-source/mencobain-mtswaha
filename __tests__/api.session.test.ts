/**
 * Unit tests untuk app/api/session/route.ts
 * Test: GET, POST, PATCH
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
import { GET, POST, PATCH } from '@/app/api/session/route';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockQuery       = query as jest.Mock;
const mockQueryOne    = queryOne as jest.Mock;
const mockExecute     = execute as jest.Mock;

function makeReq(method: string, body?: object, search?: string) {
  const url = `http://localhost/api/session${search ? '?' + search : ''}`;
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  });
}

beforeEach(() => jest.clearAllMocks());

// -- GET ----------------------------------------------------------------------
describe('GET /api/session', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET(makeReq('GET', undefined, 'siswaId=s1&jadwalId=j1'));
    expect(res.status).toBe(401);
  });

  test('returns 400 jika siswaId tidak ada', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(400);
  });

  test('returns 400 jika jadwalId tidak ada', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await GET(makeReq('GET', undefined, 'siswaId=s1'));
    expect(res.status).toBe(400);
  });

  test('returns 200 null jika session tidak ditemukan', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    // call 1: siswas lookup — siswa.id harus sama dengan siswaId di query param
    mockQueryOne
      .mockResolvedValueOnce({ id: 's1' })  // siswas lookup: id cocok dengan siswaId=s1
      .mockResolvedValueOnce(null);          // session_ujians: tidak ditemukan
    const res = await GET(makeReq('GET', undefined, 'siswaId=s1&jadwalId=j1'));
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  test('returns 200 dengan data session', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    // call 1: siswas lookup, call 2: session_ujians data
    mockQueryOne
      .mockResolvedValueOnce({ id: 's1' })
      .mockResolvedValueOnce({ id: 'ses1', id_siswa: 's1', id_jadwal: 'j1', status: 'belum' });
    const res = await GET(makeReq('GET', undefined, 'siswaId=s1&jadwalId=j1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('ses1');
  });

  test('returns 403 jika siswa coba akses session orang lain', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    // siswas lookup mengembalikan id berbeda dari siswaId di query param
    mockQueryOne.mockResolvedValueOnce({ id: 's-lain' });
    const res = await GET(makeReq('GET', undefined, 'siswaId=s1&jadwalId=j1'));
    expect(res.status).toBe(403);
  });

  test('returns 200 tanpa ownership check jika proktor', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    // proktor tidak perlu siswas lookup — langsung query session
    mockQueryOne.mockResolvedValueOnce({ id: 'ses1', id_siswa: 's1', id_jadwal: 'j1', status: 'berlangsung' });
    const res = await GET(makeReq('GET', undefined, 'siswaId=s1&jadwalId=j1'));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe('ses1');
  });

  test('returns 500 jika DB error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQueryOne.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeReq('GET', undefined, 'siswaId=s1&jadwalId=j1'));
    expect(res.status).toBe(500);
  });
});

// -- POST ---------------------------------------------------------------------
describe('POST /api/session', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(makeReq('POST', { siswaId: 's1', jadwalId: 'j1' }));
    expect(res.status).toBe(401);
  });

  test('returns 400 jika siswaId atau jadwalId tidak ada', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await POST(makeReq('POST', { siswaId: 's1' }));
    expect(res.status).toBe(400);
  });

  test('returns 200 session yang sudah ada jika duplikat', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQueryOne
      .mockResolvedValueOnce({ id: 'ses-existing' })  // cek duplikat: ada
      .mockResolvedValueOnce({ id: 'ses-existing', id_siswa: 's1', status: 'belum' }); // full data
    const res = await POST(makeReq('POST', { siswaId: 's1', jadwalId: 'j1' }));
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe('ses-existing');
  });

  test('returns 201 session baru setelah buat session', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });

    const soals = [
      { id: 'q1', opsi_a: 'A', opsi_b: 'B', opsi_c: 'C', opsi_d: 'D' },
      { id: 'q2', opsi_a: 'A', opsi_b: 'B', opsi_c: 'C', opsi_d: 'D' },
    ];

    mockQueryOne
      // cek duplikat: tidak ada
      .mockResolvedValueOnce(null)
      // jadwal + ujian
      .mockResolvedValueOnce({
        id: 'j1', durasi_menit: 60,
        ujians: { id: 'u1', acak_soal: false, acak_opsi: false },
      })
      // INSERT session RETURNING *
      .mockResolvedValueOnce({ id: 'ses-new', id_siswa: 's1', id_jadwal: 'j1', status: 'berlangsung' });

    // query: soals untuk ujian
    mockQuery.mockResolvedValue(soals);
    // execute: INSERT jawabans per soal
    mockExecute.mockResolvedValue(1);

    const res = await POST(makeReq('POST', { siswaId: 's1', jadwalId: 'j1' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    // route returns session object directly
    expect(body.id).toBe('ses-new');
  });

  test('returns 500 jika DB error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQueryOne.mockRejectedValue(new Error('DB error'));
    const res = await POST(makeReq('POST', { siswaId: 's1', jadwalId: 'j1' }));
    expect(res.status).toBe(500);
  });
});

// -- PATCH --------------------------------------------------------------------
describe('PATCH /api/session', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await PATCH(makeReq('PATCH', { sessionId: 'ses1', status: 'berlangsung' }));
    expect(res.status).toBe(401);
  });

  test('returns 400 jika sessionId tidak ada (A-05)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await PATCH(makeReq('PATCH', { status: 'berlangsung' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('sessionId');
  });

  test('returns 200 ok:true jika tidak ada field yang diupdate', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    // call 1: session (ownership), call 2: siswas lookup
    mockQueryOne
      .mockResolvedValueOnce({ id: 'ses1', id_siswa: 's1' })
      .mockResolvedValueOnce({ id: 's1' });
    // setClauses kosong -> langsung return {ok: true} tanpa execute
    const res = await PATCH(makeReq('PATCH', { sessionId: 'ses1' }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockExecute).not.toHaveBeenCalled();
  });

  test('berhasil update status session', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    // call 1: session (ownership), call 2: siswas lookup
    mockQueryOne
      .mockResolvedValueOnce({ id: 'ses1', id_siswa: 's1' })
      .mockResolvedValueOnce({ id: 's1' });
    mockExecute.mockResolvedValue(1);
    const res = await PATCH(makeReq('PATCH', { sessionId: 'ses1', status: 'berlangsung' }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('berhasil update sisa_waktu', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    // call 1: session (ownership), call 2: siswas lookup
    mockQueryOne
      .mockResolvedValueOnce({ id: 'ses1', id_siswa: 's1' })
      .mockResolvedValueOnce({ id: 's1' });
    mockExecute.mockResolvedValue(1);
    const res = await PATCH(makeReq('PATCH', { sessionId: 'ses1', sisa_waktu: 1800 }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(mockExecute).toHaveBeenCalledWith(
      expect.stringContaining('sisa_waktu'),
      expect.arrayContaining([1800, 'ses1'])
    );
  });

  test('returns 403 jika siswa update session orang lain', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    // session milik siswa lain
    mockQueryOne
      .mockResolvedValueOnce({ id: 'ses1', id_siswa: 's-lain' })
      .mockResolvedValueOnce({ id: 's1' }); // siswas lookup: id tidak cocok
    const res = await PATCH(makeReq('PATCH', { sessionId: 'ses1', status: 'berlangsung' }));
    expect(res.status).toBe(403);
  });

  test('returns 400 jika siswa coba set status force_submit', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQueryOne
      .mockResolvedValueOnce({ id: 'ses1', id_siswa: 's1' })
      .mockResolvedValueOnce({ id: 's1' });
    const res = await PATCH(makeReq('PATCH', { sessionId: 'ses1', status: 'force_submit' }));
    expect(res.status).toBe(400);
  });

  test('proktor bisa update status force_submit', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    // proktor: hanya perlu session lookup, tidak ada siswas check
    mockQueryOne.mockResolvedValueOnce({ id: 'ses1', id_siswa: 's1' });
    mockExecute.mockResolvedValue(1);
    const res = await PATCH(makeReq('PATCH', { sessionId: 'ses1', status: 'force_submit' }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('returns 500 jika DB error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQueryOne.mockRejectedValue(new Error('DB error'));
    const res = await PATCH(makeReq('PATCH', { sessionId: 'ses1', status: 'berlangsung' }));
    expect(res.status).toBe(500);
  });
});
