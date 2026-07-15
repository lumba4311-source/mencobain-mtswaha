import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient, createSupabaseAuthClient } from '@/lib/supabase';
import { authLog, authWarn, authError } from '@/lib/authDebug';
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from '../login/route';

const COOKIE_BASE = {
  httpOnly: true,
  secure:   process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  path:     '/',
};

export async function GET(req: NextRequest) {
  try {
    // Prioritas: 1) Bearer token dari header, 2) cookie HttpOnly
    let accessToken  = req.headers.get('authorization')?.replace('Bearer ', '') ?? null;
    let refreshToken = req.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null;

    if (!accessToken) {
      accessToken = req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null;
    }

    if (!accessToken && !refreshToken) {
      authWarn('SESSION_NOT_FOUND', 'No token in header or cookie');
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    const supabase = createSupabaseServerClient();

    // Coba validasi access token dulu
    if (accessToken) {
      authLog('TOKEN_VALIDATION', 'Validating access token');
      const { data: { user }, error } = await supabase.auth.getUser(accessToken);

      if (!error && user) {
        authLog('SESSION_FOUND', `user=${user.id}`);
        return await buildProfileResponse(supabase, user.id, accessToken, null, req, false);
      }

      // Access token expired — coba refresh
      authWarn('ACCESS_TOKEN_EXPIRED', 'Trying refresh token');
    }

    // Refresh token flow
    if (refreshToken) {
      authLog('AUTO_REFRESH_SESSION', 'Using refresh token');
      const authClient = createSupabaseAuthClient();

      // Kita perlu set session dulu dengan token lama agar bisa refresh
      // Pakai refreshSession endpoint langsung
      const { data, error: refreshError } = await authClient.auth.refreshSession({ refresh_token: refreshToken });

      if (refreshError || !data.session || !data.user) {
        authError('REFRESH_TOKEN_FAILED', refreshError?.message ?? 'No session returned');
        // Refresh token invalid/expired — hapus cookie dan minta login ulang
        const res = NextResponse.json({ error: 'Session expired. Please login again.' }, { status: 401 });
        res.cookies.delete(ACCESS_TOKEN_COOKIE);
        res.cookies.delete(REFRESH_TOKEN_COOKIE);
        return res;
      }

      authLog('REFRESH_TOKEN_SUCCESS', `new token expires=${data.session.expires_at}`);

      // Update cookie dengan token baru
      const result = await buildProfileResponse(supabase, data.user.id, data.session.access_token, data.session.refresh_token, req, true);
      return result;
    }

    authWarn('SESSION_NOT_FOUND', 'All token validation failed');
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  } catch (e) {
    authError('NETWORK_ERROR', String(e));
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}

async function buildProfileResponse(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  userId: string,
  newAccessToken: string,
  newRefreshToken: string | null,
  _req: NextRequest,
  shouldSetCookies: boolean,
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    return NextResponse.json({ error: 'Profil tidak ditemukan.' }, { status: 404 });
  }

  let siswa = null;
  let guru  = null;

  if (profile.role === 'siswa') {
    const { data } = await supabase.from('siswas').select('*').eq('id_user', profile.id).single();
    siswa = data;
  }
  if (profile.role === 'guru') {
    const { data } = await supabase.from('gurus').select('*').eq('id_user', profile.id).single();
    guru = data;
  }

  authLog('SESSION_RESTORED', `role=${profile.role} user=${profile.username}`);

  const res = NextResponse.json({
    user: {
      id:       profile.id,
      username: profile.username,
      nama:     profile.nama,
      role:     profile.role,
      status:   profile.status,
    },
    siswa,
    guru,
    // Kembalikan token baru agar browser client bisa update setSession()
    access_token:  newAccessToken,
    refresh_token: newRefreshToken,
  });

  // Update cookie jika token baru (setelah refresh)
  if (shouldSetCookies && newRefreshToken) {
    const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    res.cookies.set(ACCESS_TOKEN_COOKIE,  newAccessToken,  { ...COOKIE_BASE, expires: new Date(Date.now() + 60 * 60 * 1000) });
    res.cookies.set(REFRESH_TOKEN_COOKIE, newRefreshToken, { ...COOKIE_BASE, expires: refreshExpires });
  }

  return res;
}
