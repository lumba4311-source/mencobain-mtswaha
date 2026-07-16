/**
 * Unit tests untuk app/api/akun/route.ts
 * Test: GET, POST, PATCH, DELETE
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/apiAuth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/db', () => ({
  query:    jest.fn(),
  queryOne: jest.fn(),
  execute:  jest.fn(),
}));
jest.mock('bcryptjs', () => ({ hash: jest.fn().mockResolvedValue('hashed-pw') }));

import { getAuthUser } from '@/lib/apiAuth';
import { query, queryOne, execute } from '@/lib/db';
import { GET, POST, PATCH, DELETE } from '@/app/api/akun/route';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockQuery       = query as jest.Mock;
const mockQueryOne    = queryOne as jest.Mock;
const mockExecute     = execute as jest.Mock;

function makeReq(method: string, body?: object, params?: string) {
  const url = `http://localhost/api/akun${params ? `?${params}` : ''}`;
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  });
}

beforeEach(() => jest.clearAllMocks());

// ── GET ──────────────────────────────────────────────────────────────────────
describe('GET /api/akun', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(401);
  });

  test('returns 403 jika role tidak diizinkan', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'unknown' });
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(403);
  });

  test('returns 200 dengan data profiles, siswas, gurus, kelas', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    // query dipanggil 4x: profiles, siswas, gurus, kelas
    mockQuery
      .mockResolvedValueOnce([{ id: 'p1', username: 'user1', nama: 'User 1', role: 'siswa', status: 'aktif' }])
      .mockResolvedValueOnce([{ id: 's1', nama: 'Siswa 1' }])
      .mockResolvedValueOnce([{ id: 'g1', nama: 'Guru 1' }])
      .mockResolvedValueOnce([{ id: 'k1', nama: 'Kelas A' }]);

    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.profiles).toHaveLength(1);
    expect(body.siswas).toHaveLength(1);
    expect(body.gurus).toHaveLength(1);
    expect(body.kelas).toHaveLength(1);
  });

  test('returns 200 — semua role diizinkan (siswa, guru)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u2', role: 'guru' });
    mockQuery.mockResolvedValue([]);
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(200);
  });

  test('returns 500 jika DB error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockQuery.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(500);
  });
});

// ── POST ─────────────────────────────────────────────────────────────────────
describe('POST /api/akun', () => {
  const validBody = {
    username: 'siswa01', password: 'pass123', nama: 'Siswa Satu',
    role: 'siswa', status: 'aktif', nis: '12345', id_kelas: 'k1',
  };

  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(makeReq('POST', validBody));
    expect(res.status).toBe(401);
  });

  test('returns 403 jika role guru', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    const res = await POST(makeReq('POST', validBody));
    expect(res.status).toBe(403);
  });

  test('returns 400 jika username kosong', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const res = await POST(makeReq('POST', { ...validBody, username: '' }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('Username');
  });

  test('returns 400 jika role tidak valid', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const res = await POST(makeReq('POST', { ...validBody, role: 'hacker' }));
    expect(res.status).toBe(400);
  });

  test('returns 409 jika username sudah ada', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockQueryOne.mockResolvedValueOnce({ id: 'existing-id' }); // username exists
    const res = await POST(makeReq('POST', validBody));
    expect(res.status).toBe(409);
  });

  test('returns 201 setelah berhasil buat akun siswa', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockQueryOne
      .mockResolvedValueOnce(null)              // cek username — tidak ada
      .mockResolvedValueOnce({ id: 'profile-new' }); // INSERT profiles RETURNING id
    mockExecute.mockResolvedValue(1);           // INSERT siswas
    const res = await POST(makeReq('POST', validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBe('profile-new');
  });

  test('returns 201 setelah berhasil buat akun guru', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockQueryOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'profile-guru' });
    mockExecute.mockResolvedValue(1);           // INSERT gurus
    const res = await POST(makeReq('POST', { ...validBody, role: 'guru', nip: '999' }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

// ── PATCH ────────────────────────────────────────────────────────────────────
describe('PATCH /api/akun', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await PATCH(makeReq('PATCH', { id: 'p1', nama: 'Edit' }));
    expect(res.status).toBe(401);
  });

  test('returns 403 jika role siswa', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await PATCH(makeReq('PATCH', { id: 'p1', nama: 'Edit' }));
    expect(res.status).toBe(403);
  });

  test('returns 400 jika id tidak ada', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const res = await PATCH(makeReq('PATCH', { nama: 'Edit' }));
    expect(res.status).toBe(400);
  });

  test('update profil berhasil tanpa ganti password', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockExecute.mockResolvedValue(1);
    // userId + status: execute 1x (UPDATE profiles) + 0x (nama undefined)
    const res = await PATCH(makeReq('PATCH', { userId: 'p1', status: 'aktif' }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  test('update profil dengan password baru — hash dipanggil', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockExecute.mockResolvedValue(1);
    const res = await PATCH(makeReq('PATCH', { userId: 'p1', nama: 'Nama', password: 'newpass' }));
    expect(res.status).toBe(200);
    const { hash } = await import('bcryptjs');
    expect(hash).toHaveBeenCalledWith('newpass', 10);
  });
});

// ── DELETE ───────────────────────────────────────────────────────────────────
describe('DELETE /api/akun', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await DELETE(makeReq('DELETE', undefined, 'id=123&type=siswa'));
    expect(res.status).toBe(401);
  });

  test('returns 403 jika role guru', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    const res = await DELETE(makeReq('DELETE', undefined, 'id=123&type=siswa'));
    expect(res.status).toBe(403);
  });

  test('returns 400 jika id atau type tidak ada', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const res = await DELETE(makeReq('DELETE', undefined, 'id=123'));
    expect(res.status).toBe(400);
  });

  test('returns 404 jika data tidak ditemukan', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockQueryOne.mockResolvedValue(null);
    const res = await DELETE(makeReq('DELETE', undefined, 'id=123&type=siswa'));
    expect(res.status).toBe(404);
  });

  test('returns 200 setelah berhasil hapus siswa', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockQueryOne.mockResolvedValue({ id_user: 'profile-id-1' });
    mockExecute.mockResolvedValue(1);
    const res = await DELETE(makeReq('DELETE', undefined, 'id=123&type=siswa'));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    // execute dipanggil 2x: DELETE siswas, DELETE profiles
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  test('returns 200 setelah berhasil hapus guru', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'admin' });
    mockQueryOne.mockResolvedValue({ id_user: 'profile-id-2' });
    mockExecute.mockResolvedValue(1);
    const res = await DELETE(makeReq('DELETE', undefined, 'id=456&type=guru'));
    expect(res.status).toBe(200);
  });
});
