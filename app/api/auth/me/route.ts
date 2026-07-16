import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import { queryOne, query } from '@/lib/db';
import { ACCESS_TOKEN_COOKIE } from '../login/route';

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET tidak diset.');
  return new TextEncoder().encode(secret);
}

export async function GET(req: NextRequest) {
  try {
    const accessToken =
      req.headers.get('authorization')?.replace('Bearer ', '') ??
      req.cookies.get(ACCESS_TOKEN_COOKIE)?.value ??
      null;

    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
    }

    // Verifikasi JWT
    let payload: { sub?: string; role?: string; username?: string };
    try {
      const result = await jwtVerify(accessToken, getJwtSecret());
      payload = result.payload as typeof payload;
    } catch {
      return NextResponse.json({ error: 'Token tidak valid atau sudah expired.' }, { status: 401 });
    }

    const userId = payload.sub;
    if (!userId) {
      return NextResponse.json({ error: 'Token tidak valid.' }, { status: 401 });
    }

    // Ambil profil dari DB
    const profile = await queryOne<{
      id: string; username: string; nama: string; role: string; status: string;
    }>(
      'SELECT id, username, nama, role, status FROM profiles WHERE id = $1',
      [userId]
    );

    if (!profile) {
      return NextResponse.json({ error: 'Profil tidak ditemukan.' }, { status: 404 });
    }

    // Ambil data siswa / guru
    let siswa = null;
    let guru  = null;

    if (profile.role === 'siswa') {
      const rows = await query(
        `SELECT s.*, k.nama_kelas FROM siswas s LEFT JOIN kelas k ON k.id = s.id_kelas WHERE s.id_user = $1 LIMIT 1`,
        [profile.id]
      );
      siswa = rows[0] ?? null;
    }
    if (profile.role === 'guru') {
      const rows = await query('SELECT * FROM gurus WHERE id_user = $1 LIMIT 1', [profile.id]);
      guru = rows[0] ?? null;
    }

    return NextResponse.json({
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
  } catch (err: unknown) {
    console.error('[ME_ERROR]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Terjadi kesalahan server.' }, { status: 500 });
  }
}
