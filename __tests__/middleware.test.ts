/**
 * Unit tests untuk middleware.ts (JWT mandiri via jose)
 * Test: F-01 role-check, token validation, redirect logic
 */

import { NextRequest } from 'next/server';

jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
}));

import { jwtVerify } from 'jose';
import { middleware } from '@/middleware';

const mockJwtVerify = jwtVerify as jest.Mock;

function makeReq(pathname: string, cookies: Record<string, string> = {}) {
  const url = `http://localhost${pathname}`;
  const req = new NextRequest(url);
  Object.defineProperty(req, 'cookies', {
    value: {
      get: (name: string) => cookies[name] ? { value: cookies[name] } : undefined,
    },
    configurable: true,
  });
  return req;
}

describe('middleware — halaman publik', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-min-32-chars-long-enough';
  });

  test('lewati tanpa redirect untuk halaman publik (/)', async () => {
    const res = await middleware(makeReq('/'));
    expect(res.headers.get('location')).toBeNull();
  });

  test('lewati tanpa redirect untuk /api/...', async () => {
    const res = await middleware(makeReq('/api/session'));
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('middleware — tidak ada token', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-min-32-chars-long-enough';
  });

  test('redirect ke /login dari /siswa/dashboard', async () => {
    const res = await middleware(makeReq('/siswa/dashboard'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  test('redirect ke /login dari /proktor/dashboard', async () => {
    const res = await middleware(makeReq('/proktor/dashboard'));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  test('/login tanpa token — boleh akses', async () => {
    const res = await middleware(makeReq('/login'));
    expect(res.headers.get('location')).toBeNull();
  });
});

describe('middleware — sudah login', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-min-32-chars-long-enough';
  });

  test('siswa akses /login → redirect ke /siswa/dashboard', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u1', role: 'siswa', username: 's1' } });
    const res = await middleware(makeReq('/login', { 'umbk-access-token': 'valid-token' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/siswa/dashboard');
  });

  test('proktor akses /login → redirect ke /proktor/dashboard', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u2', role: 'proktor', username: 'p1' } });
    const res = await middleware(makeReq('/login', { 'umbk-access-token': 'valid-token' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/proktor/dashboard');
  });

  test('guru akses /login → redirect ke /guru/dashboard', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u3', role: 'guru', username: 'g1' } });
    const res = await middleware(makeReq('/login', { 'umbk-access-token': 'valid-token' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/guru/dashboard');
  });
});

describe('middleware — F-01 role check', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-min-32-chars-long-enough';
  });

  test('siswa akses /proktor → redirect ke /siswa/dashboard', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u1', role: 'siswa', username: 's1' } });
    const res = await middleware(makeReq('/proktor/dashboard', { 'umbk-access-token': 'valid-token' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/siswa/dashboard');
  });

  test('guru akses /siswa → redirect ke /guru/dashboard', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u2', role: 'guru', username: 'g1' } });
    const res = await middleware(makeReq('/siswa/ujian/abc', { 'umbk-access-token': 'valid-token' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/guru/dashboard');
  });

  test('proktor akses /proktor → diizinkan', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u3', role: 'proktor', username: 'p1' } });
    const res = await middleware(makeReq('/proktor/dashboard', { 'umbk-access-token': 'valid-token' }));
    expect(res.headers.get('location')).toBeNull();
  });

  test('admin akses /proktor → diizinkan', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u4', role: 'admin', username: 'a1' } });
    const res = await middleware(makeReq('/proktor/monitoring', { 'umbk-access-token': 'valid-token' }));
    expect(res.headers.get('location')).toBeNull();
  });

  test('siswa akses /siswa → diizinkan', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u5', role: 'siswa', username: 's1' } });
    const res = await middleware(makeReq('/siswa/dashboard', { 'umbk-access-token': 'valid-token' }));
    expect(res.headers.get('location')).toBeNull();
  });

  test('token expired → redirect ke /login', async () => {
    mockJwtVerify.mockRejectedValue(new Error('JWTExpired'));
    const res = await middleware(makeReq('/siswa/dashboard', { 'umbk-access-token': 'expired-token' }));
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });
});
