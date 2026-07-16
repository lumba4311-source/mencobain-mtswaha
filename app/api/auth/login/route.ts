import { NextRequest, NextResponse } from 'next/server';
import { SignJWT } from 'jose';
import { compare } from 'bcryptjs';
import { queryOne, query } from '@/lib/db';

export const ACCESS_TOKEN_COOKIE  = 'umbk-access-token';
export const REFRESH_TOKEN_COOKIE = 'umbk-refresh-token';

const COOKIE_BASE = {
  httpOnly: true,
  secure:   process.env.COOKIE_SECURE === 'true',
  sameSite: 'lax' as const,
  path:     '/',
};

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET env var tidak diset.');
  return new TextEncoder().encode(secret);
}

interface Profile {
  id: string;
  username: string;
  password: string;
  nama: string;
  role: string;
  status: string;
}

export async function POST(req: NextRequest) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password wajib diisi.' },
        { status: 400 }
      );
    }

    // Ambil profil berdasarkan username
    const profile = await queryOne<Profile>(
      'SELECT id, username, password, nama, role, status FROM profiles WHERE username = $1',
      [username]
    );

    if (!profile) {
      return NextResponse.json(
        { error: 'Username atau password salah.' },
        { status: 401 }
      );
    }

    // Verifikasi password dengan bcrypt
    const passwordValid = await compare(password, profile.password);
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Username atau password salah.' },
        { status: 401 }
      );
    }

    if (profile.status === 'nonaktif') {
      return NextResponse.json(
        { error: 'Akun Anda tidak aktif. Hubungi administrator.' },
        { status: 403 }
      );
    }

    // Sign JWT — berlaku 1 jam
    const accessToken = await new SignJWT({
      sub:      profile.id,
      role:     profile.role,
      username: profile.username,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(getJwtSecret());

    // Ambil data siswa / guru
    let siswa = null;
    let guru  = null;

    if (profile.role === 'siswa') {
      const rows = await query(
        'SELECT * FROM siswas WHERE id_user = $1 LIMIT 1',
        [profile.id]
      );
      siswa = rows[0] ?? null;
    }
    if (profile.role === 'guru') {
      const rows = await query(
        'SELECT * FROM gurus WHERE id_user = $1 LIMIT 1',
        [profile.id]
      );
      guru = rows[0] ?? null;
    }

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
      access_token: accessToken,
    });

    const accessExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 jam
    res.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, { ...COOKIE_BASE, expires: accessExpires });

    return res;
  } catch (err: unknown) {
    console.error('[LOGIN_ERROR]', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: 'Terjadi kesalahan server.' },
      { status: 500 }
    );
  }
}
