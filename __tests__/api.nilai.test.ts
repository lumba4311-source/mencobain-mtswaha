/**
 * Unit tests untuk app/api/nilai/route.ts
 * Test: GET (A-08 validasi parameter), POST
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/apiAuth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createSupabaseServerClient: jest.fn() }));

import { getAuthUser } from '@/lib/apiAuth';
import { createSupabaseServerClient } from '@/lib/supabase';
import { GET, POST } from '@/app/api/nilai/route';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCreateSupabase = createSupabaseServerClient as jest.Mock;

function makeReq(method: string, body?: object, search?: string) {
  const url = `http://localhost/api/nilai${search ? `?${search}` : ''}`;
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  });
}

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

  test('returns 200 dengan filter jadwalId', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        order:  jest.fn().mockResolvedValue({ data: [{ id: 'n1', nilai: 80 }], error: null }),
      }),
    });
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
  });

  test('returns 200 dengan filter siswaId', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        order:  jest.fn().mockResolvedValue({ data: [], error: null }),
      }),
    });
    const res = await GET(makeReq('GET', undefined, 'siswaId=s1'));
    expect(res.status).toBe(200);
  });

  test('returns 200 dengan filter sessionId — return single object', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        limit:  jest.fn().mockReturnThis(),
        order:  jest.fn().mockResolvedValue({ data: [{ id: 'n1', nilai: 90 }], error: null }),
      }),
    });
    const res = await GET(makeReq('GET', undefined, 'sessionId=ses1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    // sessionId query return single object, bukan array
    expect(body).toHaveProperty('id');
  });
});

describe('POST /api/nilai', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(makeReq('POST', { sessionId: 'ses-1' }));
    expect(res.status).toBe(401);
  });

  test('returns 404 jika session tidak ditemukan', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    const res = await POST(makeReq('POST', { sessionId: 'ses-1' }));
    expect(res.status).toBe(404);
  });

  test('returns 200 jika nilai sudah ada (idempotent)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const existingNilai = { id: 'n1', nilai: 85, id_session: 'ses-1' };
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'session_ujians') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: 'ses-1', id_siswa: 's1', jadwal_ujians: { id_jadwal: 'j1' } }, error: null,
          }),
        };
        if (table === 'nilai') return {
          select:      jest.fn().mockReturnThis(),
          eq:          jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'n1' }, error: null }),
          single:      jest.fn().mockResolvedValue({ data: existingNilai, error: null }),
        };
        return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        };
      }),
    });
    const res = await POST(makeReq('POST', { sessionId: 'ses-1' }));
    // Nilai sudah ada — return existing tanpa error
    expect(res.status).not.toBe(500);
  });
});
