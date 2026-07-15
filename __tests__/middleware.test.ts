/**
 * Unit tests untuk middleware.ts
 * Test: F-01 role-check, token validation, redirect logic, token refresh
 */

import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

// Mock @supabase/supabase-js
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import { middleware } from '@/middleware';

const mockCreateClient = createClient as jest.Mock;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeReq(pathname: string, cookies: Record<string, string> = {}) {
  const url = `http://localhost${pathname}`;
  const req = new NextRequest(url);
  // Set cookies via header (NextRequest tidak support set cookie langsung di constructor)
  const cookieHeader = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join('; ');
  if (cookieHeader) {
    Object.defineProperty(req, 'cookies', {
      value: {
        get: (name: string) => cookies[name] ? { value: cookies[name] } : undefined,
      },
    });
  } else {
    Object.defineProperty(req, 'cookies', {
      value: { get: () => undefined },
    });
  }
  return req;
}

function mockSupabaseService(getUserResult: object, profileData?: object) {
  mockCreateClient.mockImplementation((_url: string, key: string) => ({
    auth: {
      getUser:         jest.fn().mockResolvedValue(getUserResult),
      refreshSession:  jest.fn().mockResolvedValue({ data: { session: null, user: null }, error: new Error('no refresh') }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: profileData ?? null, error: null }),
    }),
  }));
}

// ─── Halaman publik ───────────────────────────────────────────────────────────

describe('middleware — halaman publik', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL        = 'http://localhost:8000';
    process.env.SUPABASE_SERVICE_ROLE_KEY       = 'service-key';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY   = 'anon-key';
  });

  test('lewati tanpa redirect untuk halaman publik (/)', async () => {
    const req = makeReq('/');
    const res = await middleware(req);
    // NextResponse.next() — tidak ada location header
    expect(res.headers.get('location')).toBeNull();
  });

  test('lewati tanpa redirect untuk /api/...', async () => {
    const req = makeReq('/api/session');
    const res = await middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });
});

// ─── Redirect ke login (tidak ada token) ─────────────────────────────────────

describe('middleware — tidak ada token', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL        = 'http://localhost:8000';
    process.env.SUPABASE_SERVICE_ROLE_KEY       = 'service-key';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY   = 'anon-key';
    mockCreateClient.mockReturnValue({
      auth: {
        getUser:        jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        refreshSession: jest.fn().mockResolvedValue({ data: { session: null, user: null }, error: new Error('no token') }),
      },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: null, error: null }),
      }),
    });
  });

  test('redirect ke /login dari /siswa/dashboard', async () => {
    const req = makeReq('/siswa/dashboard');
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  test('redirect ke /login dari /proktor/dashboard', async () => {
    const req = makeReq('/proktor/dashboard');
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/login');
  });

  test('/login tanpa token — boleh akses (NextResponse.next)', async () => {
    const req = makeReq('/login');
    const res = await middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });
});

// ─── Sudah login — akses /login redirect ke dashboard ────────────────────────

describe('middleware — sudah login', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL        = 'http://localhost:8000';
    process.env.SUPABASE_SERVICE_ROLE_KEY       = 'service-key';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY   = 'anon-key';
  });

  test('siswa akses /login → redirect ke /siswa/dashboard', async () => {
    mockSupabaseService(
      { data: { user: { id: 'u1' } }, error: null },
      { role: 'siswa' }
    );
    const req = makeReq('/login', { 'umbk-access-token': 'valid-token' });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/siswa/dashboard');
  });

  test('proktor akses /login → redirect ke /proktor/dashboard', async () => {
    mockSupabaseService(
      { data: { user: { id: 'u2' } }, error: null },
      { role: 'proktor' }
    );
    const req = makeReq('/login', { 'umbk-access-token': 'valid-token' });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/proktor/dashboard');
  });

  test('guru akses /login → redirect ke /guru/dashboard', async () => {
    mockSupabaseService(
      { data: { user: { id: 'u3' } }, error: null },
      { role: 'guru' }
    );
    const req = makeReq('/login', { 'umbk-access-token': 'valid-token' });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/guru/dashboard');
  });
});

// ─── F-01: Role check per prefix ─────────────────────────────────────────────

describe('middleware — F-01 role check', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL        = 'http://localhost:8000';
    process.env.SUPABASE_SERVICE_ROLE_KEY       = 'service-key';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY   = 'anon-key';
  });

  test('siswa akses /proktor → redirect ke /siswa/dashboard', async () => {
    mockSupabaseService(
      { data: { user: { id: 'u1' } }, error: null },
      { role: 'siswa' }
    );
    const req = makeReq('/proktor/dashboard', { 'umbk-access-token': 'valid-token' });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/siswa/dashboard');
  });

  test('guru akses /siswa → redirect ke /guru/dashboard', async () => {
    mockSupabaseService(
      { data: { user: { id: 'u2' } }, error: null },
      { role: 'guru' }
    );
    const req = makeReq('/siswa/ujian/abc', { 'umbk-access-token': 'valid-token' });
    const res = await middleware(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toContain('/guru/dashboard');
  });

  test('proktor akses /proktor → diizinkan (NextResponse.next)', async () => {
    mockSupabaseService(
      { data: { user: { id: 'u3' } }, error: null },
      { role: 'proktor' }
    );
    const req = makeReq('/proktor/dashboard', { 'umbk-access-token': 'valid-token' });
    const res = await middleware(req);
    // status 200 = NextResponse.next()
    expect(res.headers.get('location')).toBeNull();
  });

  test('admin akses /proktor → diizinkan (NextResponse.next)', async () => {
    mockSupabaseService(
      { data: { user: { id: 'u4' } }, error: null },
      { role: 'admin' }
    );
    const req = makeReq('/proktor/monitoring', { 'umbk-access-token': 'valid-token' });
    const res = await middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });

  test('siswa akses /siswa → diizinkan', async () => {
    mockSupabaseService(
      { data: { user: { id: 'u5' } }, error: null },
      { role: 'siswa' }
    );
    const req = makeReq('/siswa/dashboard', { 'umbk-access-token': 'valid-token' });
    const res = await middleware(req);
    expect(res.headers.get('location')).toBeNull();
  });
});
