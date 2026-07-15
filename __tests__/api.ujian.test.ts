/**
 * Unit tests untuk app/api/ujian/route.ts dan app/api/ujian/[id]/route.ts
 * Test: GET, POST, PUT, DELETE — termasuk A-07 (delete-then-insert kelas)
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/apiAuth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createSupabaseServerClient: jest.fn() }));

import { getAuthUser } from '@/lib/apiAuth';
import { createSupabaseServerClient } from '@/lib/supabase';
import { GET, POST } from '@/app/api/ujian/route';
import { GET as GETById, PUT, DELETE } from '@/app/api/ujian/[id]/route';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCreateSupabase = createSupabaseServerClient as jest.Mock;

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

// Helper: buat mock chain yang support .select().order().eq() atau .select().order() langsung
// GET /api/ujian: chain = .from().select().order('created_at') lalu optional .eq() atau langsung await
function makeUjianChain(resolvedValue: object, withEq = false) {
  const chain: Record<string, jest.Mock> = {};
  chain.select = jest.fn().mockReturnValue(chain);
  chain.eq     = jest.fn().mockResolvedValue(resolvedValue);
  // .order() selalu return Promise langsung (tidak ada double order di ujian)
  chain.order  = jest.fn().mockImplementation(() => {
    if (withEq) return chain; // kembalikan chain agar .eq() bisa dipanggil
    return Promise.resolve(resolvedValue);
  });
  return chain;
}

// ─── GET /api/ujian ───────────────────────────────────────────────────────────

describe('GET /api/ujian', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(401);
  });

  test('returns 200 tanpa guruId — semua ujian', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    const data = [{
      id: 'ujian-1', nama_ujian: 'UTS',
      ujian_kelas: [{ kelas_id: 'k1' }],
      soals: [{ id: 's1' }, { id: 's2' }],
      gurus: { nama: 'Pak Guru' },
    }];
    // Tanpa guruId: chain = .select().order() → resolve langsung
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue(makeUjianChain({ data, error: null }, false)),
    });
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].kelas_ids).toEqual(['k1']);
    expect(body[0].soal_count).toBe(2);
    expect(body[0].ujian_kelas).toBeUndefined();
    expect(body[0].soals).toBeUndefined();
  });

  test('returns 200 dengan filter guruId', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    const data = [{
      id: 'ujian-2', nama_ujian: 'UAS',
      ujian_kelas: [],
      soals: [],
      gurus: { nama: 'Pak Guru' },
    }];
    // Dengan guruId: chain = .select().order().eq() → resolve dari .eq()
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue(makeUjianChain({ data, error: null }, true)),
    });
    const res = await GET(makeReq('GET', undefined, 'guruId=guru-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].soal_count).toBe(0);
  });

  test('returns 500 jika DB error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    // Tanpa guruId: .order() resolve langsung dengan error
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue(makeUjianChain({ data: null, error: new Error('DB error') }, false)),
    });
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(500);
  });
});

// ─── POST /api/ujian ──────────────────────────────────────────────────────────

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
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'ujians') return {
          insert: jest.fn().mockReturnThis(),
          select: jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({ data: { id: 'ujian-new', nama_ujian: 'UTS' }, error: null }),
        };
        return { insert: jest.fn().mockResolvedValue({ error: null }) };
      }),
    });
    const res = await POST(makeReq('POST', {
      nama_ujian: 'UTS', id_guru: 'g1', jenis_ujian: 'PG',
      durasi: 60, kelas_ids: ['k1', 'k2'],
    }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe('ujian-new');
    expect(body.kelas_ids).toEqual(['k1', 'k2']);
  });
});

// ─── GET /api/ujian/[id] ──────────────────────────────────────────────────────

describe('GET /api/ujian/[id]', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GETById(makeReq('GET'), makeParams('ujian-1'));
    expect(res.status).toBe(401);
  });

  test('returns 404 jika ujian tidak ditemukan', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: new Error('not found') }),
      }),
    });
    const res = await GETById(makeReq('GET'), makeParams('ujian-xxx'));
    expect(res.status).toBe(404);
  });

  test('returns 200 dengan data ujian dan kelas_ids', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: { id: 'ujian-1', nama_ujian: 'UTS', ujian_kelas: [{ kelas_id: 'k1' }] },
          error: null,
        }),
      }),
    });
    const res = await GETById(makeReq('GET'), makeParams('ujian-1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.kelas_ids).toEqual(['k1']);
    expect(body.ujian_kelas).toBeUndefined();
  });
});

// ─── PUT /api/ujian/[id] ─────────────────────────────────────────────────────

describe('PUT /api/ujian/[id]', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await PUT(makeReq('PUT', { nama_ujian: 'UTS Edit' }), makeParams('ujian-1'));
    expect(res.status).toBe(401);
  });

  test('returns 403 jika role siswa', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await PUT(makeReq('PUT', { nama_ujian: 'UTS Edit' }), makeParams('ujian-1'));
    expect(res.status).toBe(403);
  });

  test('A-07: delete dulu lalu insert kelas baru', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    const insertCall = jest.fn().mockResolvedValue({ error: null });
    const eqForDelete = jest.fn().mockResolvedValue({ error: null });

    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'ujians') return {
          update: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockResolvedValue({ error: null }),
        };
        return {
          delete: jest.fn().mockReturnThis(),
          insert: insertCall,
          eq:     eqForDelete,
        };
      }),
    });

    const res = await PUT(
      makeReq('PUT', { nama_ujian: 'UTS Edit', kelas_ids: ['k1', 'k2'] }),
      makeParams('ujian-1')
    );
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    // insert dipanggil karena kelas_ids tidak kosong
    expect(insertCall).toHaveBeenCalledWith([
      { ujian_id: 'ujian-1', kelas_id: 'k1' },
      { ujian_id: 'ujian-1', kelas_id: 'k2' },
    ]);
  });

  test('A-07: kelas_ids kosong — hanya delete, tidak insert', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    const insertCall = jest.fn().mockResolvedValue({ error: null });

    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'ujians') return {
          update: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockResolvedValue({ error: null }),
        };
        return {
          delete: jest.fn().mockReturnThis(),
          insert: insertCall,
          eq:     jest.fn().mockResolvedValue({ error: null }),
        };
      }),
    });

    await PUT(makeReq('PUT', { kelas_ids: [] }), makeParams('ujian-1'));
    expect(insertCall).not.toHaveBeenCalled();
  });

  test('A-07: kelas_ids undefined — tidak delete dan tidak insert', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'guru' });
    const deleteCall = jest.fn().mockReturnThis();

    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'ujians') return {
          update: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockResolvedValue({ error: null }),
        };
        return {
          delete: deleteCall,
          eq:     jest.fn().mockResolvedValue({ error: null }),
        };
      }),
    });

    const res = await PUT(makeReq('PUT', { nama_ujian: 'Edit saja' }), makeParams('ujian-1'));
    expect(res.status).toBe(200);
    expect(deleteCall).not.toHaveBeenCalled();
  });
});

// ─── DELETE /api/ujian/[id] ───────────────────────────────────────────────────

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
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'jadwal_ujians') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockReturnThis(),
          limit:  jest.fn().mockResolvedValue({ data: [{ id: 'j1' }], error: null }),
        };
        return {
          delete: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockResolvedValue({ error: null }),
        };
      }),
    });
    const res = await DELETE(makeReq('DELETE'), makeParams('ujian-1'));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error).toContain('jadwal aktif');
  });

  test('returns 200 jika tidak ada jadwal aktif', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'proktor' });
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'jadwal_ujians') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockReturnThis(),
          limit:  jest.fn().mockResolvedValue({ data: [], error: null }),
        };
        return {
          delete: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockResolvedValue({ error: null }),
        };
      }),
    });
    const res = await DELETE(makeReq('DELETE'), makeParams('ujian-1'));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });
});
