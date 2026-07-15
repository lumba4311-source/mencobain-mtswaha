/**
 * Unit tests untuk app/api/akun/route.ts
 * Test: GET, POST, PATCH, DELETE
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/apiAuth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createSupabaseServerClient: jest.fn() }));

import { getAuthUser } from '@/lib/apiAuth';
import { createSupabaseServerClient } from '@/lib/supabase';
import { GET, POST, PATCH, DELETE } from '@/app/api/akun/route';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCreateSupabase = createSupabaseServerClient as jest.Mock;

function makeReq(method: string, body?: object, params?: string) {
  const url = `http://localhost/api/akun${params ? `?${params}` : ''}`;
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  });
}

// Helper: buat mock chain yang support double .order() sebelum resolve
function makeProfilesChain(resolvedValue: object) {
  // GET /api/akun: .from('profiles').select().order('role').order('nama')
  // Jest: setiap .order() harus return this agar bisa chain, lalu yang terakhir resolve
  const chain: Record<string, jest.Mock> = {};
  // order dipanggil 2x: pertama return chain, kedua return Promise
  let orderCallCount = 0;
  chain.select = jest.fn().mockReturnValue(chain);
  chain.order = jest.fn().mockImplementation(() => {
    orderCallCount++;
    if (orderCallCount >= 2) {
      // Kembalikan thenable agar await bisa resolve
      return Promise.resolve(resolvedValue);
    }
    return chain;
  });
  return chain;
}

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

    const profilesChain = makeProfilesChain({
      data: [{ id: 'p1', username: 'user1', nama: 'User 1', role: 'siswa', status: 'aktif', password: 'pass' }],
      error: null,
    });

    const simpleChain = (data: object[]) => ({
      select: jest.fn().mockResolvedValue({ data, error: null }),
    });

    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'profiles') return profilesChain;
        if (table === 'siswas')   return simpleChain([{ id: 's1' }]);
        if (table === 'gurus')    return simpleChain([{ id: 'g1' }]);
        if (table === 'kelas')    return simpleChain([{ id: 'k1' }]);
        return simpleChain([]);
      }),
    });

    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('profiles');
    expect(body).toHaveProperty('siswas');
    expect(body).toHaveProperty('gurus');
    expect(body).toHaveProperty('kelas');
  });

  test('returns 500 jika DB error pada profiles', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });

    const chain: Record<string, jest.Mock> = {};
    let orderCallCount = 0;
    chain.select = jest.fn().mockReturnValue(chain);
    chain.order  = jest.fn().mockImplementation(() => {
      orderCallCount++;
      if (orderCallCount >= 2) return Promise.resolve({ data: null, error: new Error('DB error') });
      return chain;
    });

    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue(chain),
    });

    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/akun', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(makeReq('POST', { username: 'test', password: 'pass', nama: 'Test', role: 'siswa' }));
    expect(res.status).toBe(401);
  });

  test('returns 403 jika bukan proktor/admin', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    const res = await POST(makeReq('POST', { username: 'test', password: 'pass', nama: 'Test', role: 'siswa' }));
    expect(res.status).toBe(403);
  });

  test('returns 400 jika username kosong (A-09)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const res = await POST(makeReq('POST', { username: '', password: 'pass', nama: 'Test', role: 'siswa' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Username');
  });

  test('returns 400 jika password kosong (A-09)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const res = await POST(makeReq('POST', { username: 'user1', password: '', nama: 'Test', role: 'siswa' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Password');
  });

  test('returns 400 jika nama kosong (A-09)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const res = await POST(makeReq('POST', { username: 'user1', password: 'pass', nama: '', role: 'siswa' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Nama');
  });

  test('returns 400 jika role tidak valid (A-09)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const res = await POST(makeReq('POST', { username: 'user1', password: 'pass', nama: 'Test', role: 'hacker' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('valid');
  });

  test('returns 201 setelah berhasil buat akun siswa', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockCreateSupabase.mockReturnValue({
      auth: {
        admin: {
          createUser: jest.fn().mockResolvedValue({
            data: { user: { id: 'new-user-id' } }, error: null,
          }),
        },
      },
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        insert: jest.fn().mockResolvedValue({ error: null }),
        eq:     jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    const res = await POST(makeReq('POST', {
      username: 'siswa1', password: 'pass123', nama: 'Siswa Satu', role: 'siswa',
      nis: '001', id_kelas: 'kelas-1',
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.userId).toBe('new-user-id');
  });
});

describe('PATCH /api/akun', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await PATCH(makeReq('PATCH', { userId: 'u1', status: 'nonaktif' }));
    expect(res.status).toBe(401);
  });

  test('returns 403 jika bukan proktor/admin', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await PATCH(makeReq('PATCH', { userId: 'u1', status: 'nonaktif' }));
    expect(res.status).toBe(403);
  });

  test('berhasil update status', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockCreateSupabase.mockReturnValue({
      auth: { admin: { updateUserById: jest.fn().mockResolvedValue({ error: null }) } },
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    const res = await PATCH(makeReq('PATCH', { userId: 'u1', status: 'nonaktif' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});

describe('DELETE /api/akun', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await DELETE(makeReq('DELETE', undefined, 'id=123&type=siswa'));
    expect(res.status).toBe(401);
  });

  test('returns 400 jika id tidak ada', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const res = await DELETE(makeReq('DELETE', undefined, 'type=siswa'));
    expect(res.status).toBe(400);
  });

  test('returns 400 jika type tidak ada', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const res = await DELETE(makeReq('DELETE', undefined, 'id=123'));
    expect(res.status).toBe(400);
  });

  test('returns 404 jika data tidak ditemukan', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockCreateSupabase.mockReturnValue({
      auth: { admin: { deleteUser: jest.fn().mockResolvedValue({ error: null }) } },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
        delete: jest.fn().mockReturnThis(),
      }),
    });
    const res = await DELETE(makeReq('DELETE', undefined, 'id=123&type=siswa'));
    expect(res.status).toBe(404);
  });

  test('berhasil hapus akun siswa', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockCreateSupabase.mockReturnValue({
      auth: { admin: { deleteUser: jest.fn().mockResolvedValue({ error: null }) } },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { id_user: 'auth-id-1' }, error: null }),
        delete: jest.fn().mockReturnThis(),
      }),
    });
    const res = await DELETE(makeReq('DELETE', undefined, 'id=123&type=siswa'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
