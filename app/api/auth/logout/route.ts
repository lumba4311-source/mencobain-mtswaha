import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { authLog } from '@/lib/authDebug';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../login/route';

export async function POST(req: NextRequest) {
  try {
    // Ambil refresh token dari cookie untuk revoke di Supabase
    const refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value;
    const accessToken  = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value
      ?? req.headers.get('authorization')?.replace('Bearer ', '');

    if (accessToken) {
      // Revoke session di Supabase agar refresh token tidak bisa dipakai lagi
      const supabase = createSupabaseServerClient();
      // Validasi token dulu agar kita tahu user yang logout
      const { data: { user } } = await supabase.auth.getUser(accessToken);
      if (user) {
        // Admin sign out — hapus semua session user ini
        await supabase.auth.admin.signOut(user.id, 'global');
        authLog('REDIRECT_LOGIN', `Logout user=${user.id}`);
      }
    }

    const res = NextResponse.json({ ok: true });

    // Hapus semua auth cookie
    res.cookies.set(ACCESS_TOKEN_COOKIE,  '', { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', path: '/', maxAge: 0 });
    res.cookies.set(REFRESH_TOKEN_COOKIE, '', { httpOnly: true, secure: process.env.COOKIE_SECURE === 'true', sameSite: 'lax', path: '/', maxAge: 0 });

    return res;
  } catch {
    // Tetap hapus cookie meskipun revoke gagal
    const res = NextResponse.json({ ok: true });
    res.cookies.set(ACCESS_TOKEN_COOKIE,  '', { httpOnly: true, path: '/', maxAge: 0 });
    res.cookies.set(REFRESH_TOKEN_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  }
}
