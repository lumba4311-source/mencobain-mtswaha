import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const ACCESS_TOKEN_COOKIE  = 'umbk-access-token';
const REFRESH_TOKEN_COOKIE = 'umbk-refresh-token';

// Route yang butuh autentikasi (prefix match)
const PROTECTED = ['/proktor', '/siswa', '/guru', '/admin'];
// Route yang tidak boleh diakses saat sudah login
const AUTH_ONLY = ['/login'];

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET tidak diset.');
  return new TextEncoder().encode(secret);
}

// Map role ke dashboard masing-masing
const dashboardMap: Record<string, string> = {
  admin:   '/admin/dashboard',
  proktor: '/proktor/dashboard',
  guru:    '/guru/dashboard',
  siswa:   '/siswa/dashboard',
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  const isAuthOnly  = AUTH_ONLY.some(p => pathname.startsWith(p));

  // Halaman publik — lewati
  if (!isProtected && !isAuthOnly) return NextResponse.next();

  const accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;

  let userId: string | null = null;
  let role: string | null = null;

  // Validasi JWT mandiri — tidak butuh network call ke Supabase
  if (accessToken) {
    try {
      const { payload } = await jwtVerify(accessToken, getJwtSecret());
      if (typeof payload.sub === 'string' && typeof payload.role === 'string') {
        userId = payload.sub;
        role   = payload.role;
      }
    } catch {
      // Token expired atau invalid — lanjut ke redirect
    }
  }

  // Tidak ada session valid
  if (!userId) {
    if (isProtected) {
      const loginUrl = new URL('/login', req.url);
      const res = NextResponse.redirect(loginUrl);
      res.cookies.set(ACCESS_TOKEN_COOKIE,  '', { httpOnly: true, path: '/', maxAge: 0 });
      res.cookies.set(REFRESH_TOKEN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
      return res;
    }
    return NextResponse.next();
  }

  // Sudah login tapi akses halaman login — redirect ke dashboard
  if (isAuthOnly) {
    const dest = dashboardMap[role!] ?? '/siswa/dashboard';
    return NextResponse.redirect(new URL(dest, req.url));
  }

  // Cek apakah role cocok dengan path yang diakses
  if (isProtected && role) {
    const pathRole = PROTECTED.find(p => pathname.startsWith(p))?.replace('/', '');
    const allowedRoles: Record<string, string[]> = {
      admin:   ['admin'],
      proktor: ['proktor', 'admin'],
      guru:    ['guru', 'admin'],
      siswa:   ['siswa'],
    };
    const allowed = allowedRoles[pathRole ?? ''] ?? [];
    if (!allowed.includes(role)) {
      const dest = dashboardMap[role] ?? '/siswa/dashboard';
      return NextResponse.redirect(new URL(dest, req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/proktor/:path*',
    '/siswa/:path*',
    '/guru/:path*',
    '/admin/:path*',
    '/login',
  ],
};
