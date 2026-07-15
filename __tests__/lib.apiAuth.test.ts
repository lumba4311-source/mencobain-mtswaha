/**
 * Unit tests untuk lib/apiAuth.ts
 * Test: getAuthUser() — return {id, role} atau null
 */

import { NextRequest } from 'next/server';

// Mock @supabase/supabase-js sebelum import modul
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(),
}));

import { createClient } from '@supabase/supabase-js';
import { getAuthUser } from '@/lib/apiAuth';

const mockCreateClient = createClient as jest.Mock;

function makeRequest(opts: { authHeader?: string; cookie?: string } = {}) {
  const headers = new Headers();
  if (opts.authHeader) headers.set('authorization', opts.authHeader);
  if (opts.cookie) headers.set('cookie', `umbk-access-token=${opts.cookie}`);
  return new NextRequest('http://localhost/api/test', { headers });
}

function mockSupabase(getUserResult: object, profileResult: object) {
  mockCreateClient.mockReturnValue({
    auth: { getUser: jest.fn().mockResolvedValue(getUserResult) },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      eq:     jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue(profileResult),
    }),
  });
}

describe('getAuthUser()', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL    = 'http://localhost:8000';
    process.env.SUPABASE_SERVICE_ROLE_KEY   = 'test-service-key';
  });

  test('returns null jika tidak ada token sama sekali', async () => {
    const req = makeRequest();
    const result = await getAuthUser(req);
    expect(result).toBeNull();
  });

  test('returns null jika token tidak valid (supabase error)', async () => {
    mockSupabase(
      { data: { user: null }, error: new Error('invalid token') },
      { data: null, error: null }
    );
    const req = makeRequest({ authHeader: 'Bearer invalid-token' });
    const result = await getAuthUser(req);
    expect(result).toBeNull();
  });

  test('returns null jika user valid tapi profile tidak ditemukan', async () => {
    mockSupabase(
      { data: { user: { id: 'user-123' } }, error: null },
      { data: null, error: null }
    );
    const req = makeRequest({ authHeader: 'Bearer valid-token' });
    const result = await getAuthUser(req);
    expect(result).toBeNull();
  });

  test('returns {id, role} jika token valid via Authorization header', async () => {
    mockSupabase(
      { data: { user: { id: 'user-123' } }, error: null },
      { data: { role: 'siswa' }, error: null }
    );
    const req = makeRequest({ authHeader: 'Bearer valid-token' });
    const result = await getAuthUser(req);
    expect(result).toEqual({ id: 'user-123', role: 'siswa' });
  });

  test('returns {id, role} jika token valid via cookie', async () => {
    mockSupabase(
      { data: { user: { id: 'user-456' } }, error: null },
      { data: { role: 'proktor' }, error: null }
    );
    const req = makeRequest({ cookie: 'valid-cookie-token' });
    const result = await getAuthUser(req);
    expect(result).toEqual({ id: 'user-456', role: 'proktor' });
  });

  test('Authorization header diutamakan di atas cookie', async () => {
    const mockGetUser = jest.fn().mockResolvedValue({
      data: { user: { id: 'user-header' } }, error: null,
    });
    mockCreateClient.mockReturnValue({
      auth: { getUser: mockGetUser },
      from: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: { role: 'guru' }, error: null }),
      }),
    });
    const req = makeRequest({ authHeader: 'Bearer header-token', cookie: 'cookie-token' });
    await getAuthUser(req);
    // Pastikan token yang dipakai adalah dari header
    expect(mockGetUser).toHaveBeenCalledWith('header-token');
  });
});
