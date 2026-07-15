/**
 * Unit tests untuk app/api/monitoring/route.ts
 * Test: GET (A-06), POST (force-submit)
 * Catatan: route punya GET dan POST — tidak ada PATCH
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/apiAuth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createSupabaseServerClient: jest.fn() }));

import { getAuthUser } from '@/lib/apiAuth';
import { createSupabaseServerClient } from '@/lib/supabase';
import { GET, POST } from '@/app/api/monitoring/route';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCreateSupabase = createSupabaseServerClient as jest.Mock;

function makeReq(method: string, body?: object, search?: string) {
  const url = `http://localhost/api/monitoring${search ? '?' + search : ''}`;
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  });
}

describe('GET /api/monitoring', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(401);
  });

  // monitoring hanya untuk proktor dan admin (bukan guru)
  test('returns 403 jika role bukan proktor/admin', async () => {
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
    const body = await res.json();
    expect(body.error).toContain('jadwalId');
  });

  test('returns 404 jika jadwal tidak ditemukan', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(404);
  });

  test('returns 200 array kosong jika tidak ada siswa di jadwal', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'j1', id_ujian: 'u1',
            ujians: { durasi: 60 },
            jadwal_siswa: [], // tidak ada siswa
          },
          error: null,
        }),
      }),
    });
    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  test('returns 200 dengan data monitoring lengkap (A-06)', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });

    const jadwalData = {
      id: 'j1', id_ujian: 'u1',
      ujians: { durasi: 90 },
      jadwal_siswa: [{ siswa_id: 's1' }],
    };

    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'jadwal_ujians') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: jadwalData, error: null }),
        };
        if (table === 'siswas') return {
          select: jest.fn().mockReturnThis(),
          in:     jest.fn().mockResolvedValue({ data: [{ id: 's1', nama: 'Siswa 1' }], error: null }),
        };
        if (table === 'session_ujians') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockResolvedValue({ data: [{ id: 'ses1', id_siswa: 's1', id_jadwal: 'j1' }], error: null }),
        };
        if (table === 'jawabans') return {
          select: jest.fn().mockReturnThis(),
          in:     jest.fn().mockReturnThis(),
          not:    jest.fn().mockResolvedValue({ data: [{ id_session: 'ses1', jawaban_siswa: 'A' }], error: null }),
        };
        if (table === 'soals') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockResolvedValue({ data: null, error: null, count: 5 }),
        };
        return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockResolvedValue({ data: [], error: null }),
        };
      }),
    });

    const res = await GET(makeReq('GET', undefined, 'jadwalId=j1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0]).toHaveProperty('siswa');
    expect(body[0]).toHaveProperty('jumlah_dijawab');
    expect(body[0]).toHaveProperty('durasiBatas');
    expect(body[0].durasiBatas).toBe(90);
  });
});

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
    const body = await res.json();
    expect(body.error).toContain('sessionId');
  });
});
