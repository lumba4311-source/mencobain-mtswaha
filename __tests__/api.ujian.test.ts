/**
 * Unit tests untuk app/api/ujian/route.ts dan app/api/ujian/[id]/route.ts
 * Test: GET, POST, PUT, DELETE
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
import { GET, POST } from '@/app/api/ujian/route';
import { GET as GETById, PUT, DELETE } from '@/app/api/ujian/[id]/route';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockQuery       = query as jest.Mock;
const mockQueryOne    = queryOne as jest.Mock;
const mockExecute     = execute as jest.Mock;

function makeReq(method: string, body?: object, search?: string) {
  const url = `http://localhost/api/ujian${search ? '?' + search : ''}`;
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('GET /api/ujian', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(401);
  });

  test('returns 200 semua ujian tanpa filter', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockQuery.mockResolvedValue([{
      id: 'ujian-1', nama_ujian: 'UTS', kelas_ids: ['k1'], soal_count: 2,
    }]);
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].id).toBe('ujian-1');
  });

  test('returns 200 dengan filter guruId', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    mockQuery.mockResolvedValue([{ id: 'ujian-2', nama_ujian: 'UAS', kelas_ids: [], soal_count: 0 }]);
    const res = await GET(makeReq('GET', undefined, 'guruId=guru-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].soal_count).toBe(0);
  });

  test('returns 500 jika DB error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    mockQuery.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/ujian', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(makeReq('POST', { nama_ujian: 'UTS', id_guru: 'g1' }));
    expect(res.status).toBe(401);
  });

  test('returns 403 jika role siswa', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await POST(makeReq('POST', { nama_ujian: 'UTS', id_guru: 'g1' }));
    expect(res.status).toBe(403);
  });

  test('returns 201 setelah berhasil buat ujian', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    mockQueryOne.mockResolvedValue({ id: 'ujian-new', nama_ujian: 'UTS' });
    mockExecute.mockResolvedValue(1);
    const res = await POST(makeReq('POST', {
      nama_ujian: 'UTS', id_guru: 'g1', jenis_ujian: 'UMBK',
      durasi: 60, kelas_ids: ['k1', 'k2'],
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('ujian-new');
    expect(body.kelas_ids).toEqual(['k1', 'k2']);
  });
});

describe('GET /api/ujian/[id]', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GETById(makeReq('GET'), makeParams('ujian-1'));
    expect(res.status).toBe(401);
  });

  test('returns 404 jika ujian tidak ditemukan', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    mockQueryOne.mockResolvedValue(null);
    const res = await GETById(makeReq('GET'), makeParams('ujian-xxx'));
    expect(res.status).toBe(404);
  });

  test('returns 200 dengan data ujian dan kelas_ids', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    mockQueryOne.mockResolvedValue({ id: 'ujian-1', nama_ujian: 'UTS', kelas_ids: ['k1'] });
    const res = await GETById(makeReq('GET'), makeParams('ujian-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kelas_ids).toEqual(['k1']);
  });
});

describe('PUT /api/ujian/[id]', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await PUT(makeReq('PUT', { nama_ujian: 'Edit' }), makeParams('ujian-1'));
    expect(res.status).toBe(401);
  });

  test('returns 403 jika role siswa', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await PUT(makeReq('PUT', { nama_ujian: 'Edit' }), makeParams('ujian-1'));
    expect(res.status).toBe(403);
  });

  test('update berhasil dengan kelas_ids baru', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    mockExecute.mockResolvedValue(1);
    const res = await PUT(
      makeReq('PUT', { nama_ujian: 'Edit', kelas_ids: ['k1', 'k2'] }),
      makeParams('ujian-1')
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('kelas_ids undefined — tidak update kelas', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    mockExecute.mockResolvedValue(1);
    const res = await PUT(makeReq('PUT', { nama_ujian: 'Edit saja' }), makeParams('ujian-1'));
    expect(res.status).toBe(200);
    // execute dipanggil sekali saja (UPDATE ujians), tidak ada DELETE/INSERT ujian_kelas
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });
});

describe('DELETE /api/ujian/[id]', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await DELETE(makeReq('DELETE'), makeParams('ujian-1'));
    expect(res.status).toBe(401);
  });

  test('returns 403 jika role siswa', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await DELETE(makeReq('DELETE'), makeParams('ujian-1'));
    expect(res.status).toBe(403);
  });

  test('returns 409 jika ada jadwal aktif', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockQuery.mockResolvedValue([{ id: 'j1' }]); // jadwal aktif ada
    const res = await DELETE(makeReq('DELETE'), makeParams('ujian-1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('jadwal aktif');
  });

  test('returns 200 jika tidak ada jadwal aktif', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockQuery.mockResolvedValue([]); // tidak ada jadwal aktif
    mockExecute.mockResolvedValue(1);
    const res = await DELETE(makeReq('DELETE'), makeParams('ujian-1'));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
