import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseService = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const ACCESS_TOKEN_COOKIE  = 'umbk-access-token';
const REFRESH_TOKEN_COOKIE = 'umbk-refresh-token';

// Route yang butuh autentikasi (prefix match)
const PROTECTED = ['/proktor', '/siswa', '/guru', '/admin'];
// Route yang tidak boleh diakses saat sudah login
const AUTH_ONLY = ['/login'];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isProtected = PROTECTED.some(p => pathname.startsWith(p));
  const isAuthOnly  = AUTH_ONLY.some(p => pathname.startsWith(p));

  // Halaman publik — lewati
  if (!isProtected && !isAuthOnly) return NextResponse.next();

  const accessToken  = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
  const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

  let userId: string | null = null;
  let newAccessToken: string | null = null;
  let newRefreshToken: string | null = null;

  const supabase = createClient(supabaseUrl, supabaseService, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 1. Validasi access token
  if (accessToken) {
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    if (!error && user) {
      userId = user.id;
    }
  }

  // 2. Access token expired — coba refresh via refresh token
  if (!userId && refreshToken) {
    // Buat client dengan anon key untuk refreshSession
    const anonClient = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    const { data, error } = await anonClient.auth.refreshSession({ refresh_token: refreshToken });
    if (!error && data.session && data.user) {
      userId        = data.user.id;
      newAccessToken  = data.session.access_token;
      newRefreshToken = data.session.refresh_token;
    }
  }

  // ── Tidak ada session valid ───────────────────────────────────
  if (!userId) {
    if (isProtected) {
      // Redirect ke login tanpa menyimpan tujuan asal
      const loginUrl = new URL('/login', req.url);
      const res = NextResponse.redirect(loginUrl);
      // Hapus cookie yang sudah tidak valid
      res.cookies.set(ACCESS_TOKEN_COOKIE,  '', { httpOnly: true, path: '/', maxAge: 0 });
      res.cookies.set(REFRESH_TOKEN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
      return res;
    }
    // isAuthOnly (/login) tanpa session → boleh akses
    return NextResponse.next();
  }

  // ── Ada session valid — ambil role ───────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  const role = profile?.role ?? 'siswa';
  const dashboardMap: Record<string, string> = {
    proktor: '/proktor/dashboard',
    admin:   '/proktor/dashboard',
    guru:    '/guru/dashboard',
    siswa:   '/siswa/dashboard',
  };

  if (isAuthOnly) {
    // Sudah login, tidak boleh akses /login — redirect ke dashboard sesuai role
    const dest = dashboardMap[role] ?? '/siswa/dashboard';
    return NextResponse.redirect(new URL(dest, req.url));
  }

  // ── F-01: Cek role sesuai prefix route ───────────────────────
  // Mapping prefix → role yang diizinkan
  const ROLE_FOR_PREFIX: Record<string, string[]> = {
    '/proktor': ['proktor', 'admin'],
    '/admin':   ['proktor', 'admin'],
    '/guru':    ['guru'],
    '/siswa':   ['siswa'],
  };

  const matchedPrefix = Object.keys(ROLE_FOR_PREFIX).find(p => pathname.startsWith(p));
  if (matchedPrefix) {
    const allowed = ROLE_FOR_PREFIX[matchedPrefix];
    if (!allowed.includes(role)) {
      // Role tidak sesuai — redirect ke dashboard yang benar
      const dest = dashboardMap[role] ?? '/siswa/dashboard';
      return NextResponse.redirect(new URL(dest, req.url));
    }
  }

  // isProtected + session valid + role cocok → lanjutkan
  const res = NextResponse.next();
  if (newAccessToken && newRefreshToken) {
    const COOKIE_BASE = {
      httpOnly: true,
      secure:   process.env.COOKIE_SECURE === 'true',
      sameSite: 'lax' as const,
      path:     '/',
    };
    res.cookies.set(ACCESS_TOKEN_COOKIE,  newAccessToken,  { ...COOKIE_BASE, expires: new Date(Date.now() + 60 * 60 * 1000) });
    res.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken, { ...COOKIE_BASE, expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) });
  }
  return res;
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
