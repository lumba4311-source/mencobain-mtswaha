/**
 * Unit tests untuk lib/apiAuth.ts (JWT mandiri via jose)
 * Test: getAuthUser() — return {id, role, username} atau null
 */

import { NextRequest } from 'next/server';
import { SignJWT } from 'jose';

// Mock jose jwtVerify
jest.mock('jose', () => ({
  jwtVerify: jest.fn(),
  SignJWT:    jest.requireActual('jose').SignJWT,
}));

import { jwtVerify } from 'jose';
import { getAuthUser } from '@/lib/apiAuth';

const mockJwtVerify = jwtVerify as jest.Mock;

function makeRequest(opts: { authHeader?: string; cookie?: string } = {}) {
  const headers = new Headers();
  if (opts.authHeader) headers.set('authorization', opts.authHeader);
  if (opts.cookie) headers.set('cookie', `umbk-access-token=${opts.cookie}`);
  return new NextRequest('http://localhost/api/test', { headers });
}

describe('getAuthUser()', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-min-32-chars-long-enough';
    jest.clearAllMocks();
  });

  test('returns null jika tidak ada token', async () => {
    const result = await getAuthUser(makeRequest());
    expect(result).toBeNull();
  });

  test('returns null jika JWT tidak valid', async () => {
    mockJwtVerify.mockRejectedValue(new Error('invalid token'));
    const result = await getAuthUser(makeRequest({ authHeader: 'Bearer bad-token' }));
    expect(result).toBeNull();
  });

  test('returns null jika payload tidak punya sub/role/username', async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 'u1' } }); // role missing
    const result = await getAuthUser(makeRequest({ authHeader: 'Bearer token' }));
    expect(result).toBeNull();
  });

  test('returns {id, role, username} jika token valid via Authorization header', async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { sub: 'user-123', role: 'siswa', username: 'siswa01' },
    });
    const result = await getAuthUser(makeRequest({ authHeader: 'Bearer valid-token' }));
    expect(result).toEqual({ id: 'user-123', role: 'siswa', username: 'siswa01' });
  });

  test('returns {id, role, username} jika token valid via cookie', async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { sub: 'user-456', role: 'proktor', username: 'proktor1' },
    });
    const result = await getAuthUser(makeRequest({ cookie: 'valid-cookie-token' }));
    expect(result).toEqual({ id: 'user-456', role: 'proktor', username: 'proktor1' });
  });

  test('Authorization header diutamakan di atas cookie', async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { sub: 'user-header', role: 'guru', username: 'guru01' },
    });
    const result = await getAuthUser(makeRequest({ authHeader: 'Bearer header-token', cookie: 'cookie-token' }));
    expect(result).toEqual({ id: 'user-header', role: 'guru', username: 'guru01' });
    // jwtVerify dipanggil dengan header-token (bukan cookie-token)
    expect(mockJwtVerify).toHaveBeenCalledWith('header-token', expect.any(Uint8Array));
  });
});
