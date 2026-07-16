import { NextRequest, NextResponse } from 'next/server';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../login/route';

export async function POST(_req: NextRequest) {
  const res = NextResponse.json({ ok: true });

  // Hapus cookie — tidak perlu revoke ke server karena JWT stateless
  res.cookies.set(ACCESS_TOKEN_COOKIE,  '', {
    httpOnly: true,
    secure:   process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path:     '/',
    maxAge:   0,
  });
  res.cookies.set(REFRESH_TOKEN_COOKIE, '', {
    httpOnly: true,
    secure:   process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    path:     '/',
    maxAge:   0,
  });

  return res;
}
