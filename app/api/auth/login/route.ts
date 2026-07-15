import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseAuthClient, createSupabaseServerClient } from '@/lib/supabase';
import { authLog, authError } from '@/lib/authDebug';

// Cookie names
export const ACCESS_TOKEN_COOKIE  = 'umbk-access-token';
export const REFRESH_TOKEN_COOKIE = 'umbk-refresh-token';

// Cookie options — HttpOnly, Secure (prod), SameSite=Lax
const COOKIE_BASE = {
  httpOnly: true,
  // Secure hanya aktif jika eksplisit di-enable via env var
  // Untuk deployment HTTP (non-HTTPS), biarkan false agar cookie terkirim
  secure:   process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  path:     '/',
};

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password wajib diisi.' },
        { status: 400 }
      );
    }

    // Login via Supabase Auth
    const authClient = createSupabaseAuthClient();
    const { data: authData, error: authError_ } = await authClient.auth.signInWithPassword({
      email: `${username}@umbk.local`,
      password,
    });

    if (authError_ || !authData.user || !authData.session) {
      authError('REDIRECT_LOGIN', `Login failed: ${authError_?.message}`);
      return NextResponse.json(
        { error: 'Username atau password salah.' },
        { status: 401 }
      );
    }

    const supabase = createSupabaseServerClient();

    // Ambil profil
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profil pengguna tidak ditemukan.' },
        { status: 404 }
      );
    }

    if (profile.status === 'nonaktif') {
      return NextResponse.json(
        { error: 'Akun Anda tidak aktif. Hubungi administrator.' },
        { status: 403 }
      );
    }

    // Ambil data siswa / guru
    let siswa = null;
    let guru  = null;

    if (profile.role === 'siswa') {
      const { data } = await supabase
        .from('siswas').select('*').eq('id_user', profile.id).single();
      siswa = data;
    }
    if (profile.role === 'guru') {
      const { data } = await supabase
        .from('gurus').select('*').eq('id_user', profile.id).single();
      guru = data;
    }

    authLog('LOGIN_SUCCESS', `role=${profile.role} user=${profile.username}`);

    const userData = {
      id:       profile.id,
      username: profile.username,
      nama:     profile.nama,
      role:     profile.role,
      status:   profile.status,
    };

    const res = NextResponse.json({
      user:  userData,
      siswa,
      guru,
      // Kembalikan token ke client agar browser Supabase client bisa setSession()
      access_token:  authData.session.access_token,
      refresh_token: authData.session.refresh_token,
    });

    // Simpan token di HttpOnly cookie agar persist saat refresh
    const accessExpires  = new Date(authData.session.expires_at! * 1000);
    // Refresh token bertahan 30 hari (Supabase default rotating)
    const refreshExpires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    res.cookies.set(ACCESS_TOKEN_COOKIE,  authData.session.access_token,  { ...COOKIE_BASE, expires: accessExpires });
    res.cookies.set(REFRESH_TOKEN_COOKIE, authData.session.refresh_token, { ...COOKIE_BASE, expires: refreshExpires });

    return res;
  } catch (err: unknown) {
    console.error('[LOGIN_ERROR]', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: 'Terjadi kesalahan server.' },
      { status: 500 }
    );
  }
}
