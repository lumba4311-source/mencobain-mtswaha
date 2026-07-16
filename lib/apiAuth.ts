// ============================================================
// UMBK — MTS WAHA — API Auth (JWT mandiri, tanpa Supabase)
// ============================================================

import { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const ACCESS_TOKEN_COOKIE = 'umbk-access-token';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var tidak diset.');
  return new TextEncoder().encode(secret);
}

export interface AuthUser {
  id: string;
  role: string;
  username: string;
}

/**
 * Ambil user yang sedang login dari cookie atau Authorization header.
 * Return { id, role, username } jika token valid, null jika tidak.
 */
export async function getAuthUser(req: NextRequest): Promise<AuthUser | null> {
  const token =
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ??
    null;

  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, getJwtSecret());
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.username !== 'string'
    ) {
      return null;
    }
    return { id: payload.sub, role: payload.role, username: payload.username };
  } catch {
    return null;
  }
}
