/**
 * Unit tests untuk app/api/jawaban/route.ts
 * Test: GET, POST
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/apiAuth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/db', () => ({
  query:    jest.fn(),
  queryOne: jest.fn(),
  execute:  jest.fn(),
}));

import { getAuthUser } from '@/lib/apiAuth';
import { query, execute } from '@/lib/db';
import { GET, POST } from '@/app/api/jawaban/route';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockQuery       = query as jest.Mock;
const mockExecute     = execute as jest.Mock;

function makeReq(method: string, body?: object, search?: string) {
  const url = `http://localhost/api/jawaban${search ? '?' + search : ''}`;
  return new NextRequest(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: body ? { 'Content-Type': 'application/json' } : {},
  });
}

describe('GET /api/jawaban', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET(makeReq('GET', undefined, 'sessionId=ses1'));
    expect(res.status).toBe(401);
  });

  test('returns 400 jika sessionId tidak ada', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    const res = await GET(makeReq('GET'));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('sessionId');
  });

  test('returns 200 dengan array jawaban', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQuery.mockResolvedValue([{ id: 'j1', jawaban_siswa: 'A' }]);
    const res = await GET(makeReq('GET', undefined, 'sessionId=ses1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body[0].jawaban_siswa).toBe('A');
  });

  test('returns 200 dengan array kosong jika tidak ada jawaban', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQuery.mockResolvedValue([]);
    const res = await GET(makeReq('GET', undefined, 'sessionId=ses1'));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  test('returns 500 jika DB error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockQuery.mockRejectedValue(new Error('DB error'));
    const res = await GET(makeReq('GET', undefined, 'sessionId=ses1'));
    expect(res.status).toBe(500);
  });
});

describe('POST /api/jawaban', () => {
  test('returns 401 jika tidak login', async () => {
    mockGetAuthUser.mockResolvedValue(null);
    const res = await POST(makeReq('POST', { sessionId: 'ses1', soalId: 'q1', jawaban_siswa: 'A' }));
    expect(res.status).toBe(401);
  });

  test('upsert jawaban berhasil — returns 200 {ok: true}', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockExecute.mockResolvedValue(1);
    const res = await POST(makeReq('POST', {
      sessionId: 'ses1', soalId: 'q1', jawaban_siswa: 'A', status_soal: 'sudah',
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test('upsert jawaban null (ragu-ragu) berhasil', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockExecute.mockResolvedValue(1);
    const res = await POST(makeReq('POST', {
      sessionId: 'ses1', soalId: 'q1', jawaban_siswa: null, status_soal: 'ragu',
    }));
    expect(res.status).toBe(200);
  });

  test('returns 500 jika DB error', async () => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
    mockExecute.mockRejectedValue(new Error('conflict'));
    const res = await POST(makeReq('POST', {
      sessionId: 'ses1', soalId: 'q1', jawaban_siswa: 'B',
    }));
    expect(res.status).toBe(500);
  });
});
