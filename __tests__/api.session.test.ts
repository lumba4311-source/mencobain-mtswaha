/**
 * Unit tests untuk app/api/session/route.ts
 * Test: GET, POST, PATCH
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/apiAuth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createSupabaseServerClient: jest.fn() }));

import { getAuthUser } from '@/lib/apiAuth';
import { createSupabaseServerClient } from '@/lib/supabase';
import { GET, POST, PATCH } from '@/app/api/session/route';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCreateSupabase = createSupabaseServerClient as jest.Mock;

function makeReq(method: string, body?: object, search?: string) {
  const url = `http://localhost/api/session${search ? `?${search}` : ''}`;
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  });
}

describe('GET /api/session', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET(makeReq('GET', undefined, 'siswaId=s1&jadwalId=j1'));
    expect(res.status).toBe(401);
  });

  test('returns 400 jika siswaId atau jadwalId tidak ada', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    const res = await GET(makeReq('GET', undefined, 'siswaId=s1'));
    expect(res.status).toBe(400);
  });

  test('returns null jika session tidak ditemukan', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      }),
    });
    const res = await GET(makeReq('GET', undefined, 'siswaId=s1&jadwalId=j1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toBeNull();
  });
});

describe('POST /api/session', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(makeReq('POST', { siswaId: 's1', jadwalId: 'j1' }));
    expect(res.status).toBe(401);
  });

  test('returns 400 jika siswaId atau jadwalId kosong (A-04 validasi)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    const res = await POST(makeReq('POST', { siswaId: '', jadwalId: 'j1' }));
    expect(res.status).toBe(400);
  });

  test('returns session existing jika duplikat (A-04)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const existingSession = { id: 'ses-existing', status: 'berlangsung', id_siswa: 's1', id_jadwal: 'j1' };
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'ses-existing', status: 'berlangsung' }, error: null }),
        single:      jest.fn().mockResolvedValue({ data: existingSession, error: null }),
      }),
    });
    const res = await POST(makeReq('POST', { siswaId: 's1', jadwalId: 'j1' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('ses-existing');
  });

  test('returns 404 jika jadwal tidak ditemukan', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        const chain = {
          select:      jest.fn().mockReturnThis(),
          eq:          jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          single:      jest.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
        };
        return chain;
      }),
    });
    const res = await POST(makeReq('POST', { siswaId: 's1', jadwalId: 'j1' }));
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/session', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await PATCH(makeReq('PATCH', { sessionId: 'ses-1', status: 'berlangsung' }));
    expect(res.status).toBe(401);
  });

  test('returns 400 jika sessionId tidak ada (A-05)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await PATCH(makeReq('PATCH', { status: 'berlangsung' }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('sessionId');
  });

  test('berhasil update session', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockResolvedValue({ error: null }),
      }),
    });
    const res = await PATCH(makeReq('PATCH', { sessionId: 'ses-1', status: 'berlangsung' }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
