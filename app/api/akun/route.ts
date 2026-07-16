import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { query, queryOne, execute } from '@/lib/db';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/akun — semua user
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  // [API-06] Siswa tidak boleh akses data akun seluruh sekolah
  if (!['proktor', 'admin', 'guru'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    // password_plain hanya dikembalikan ke proktor/admin
    const includePassword = ['proktor', 'admin'].includes(auth.role);
    const profiles = await query(
      includePassword
        ? 'SELECT id, username, nama, role, status, created_at, password_plain FROM profiles ORDER BY role, nama'
        : 'SELECT id, username, nama, role, status, created_at FROM profiles ORDER BY role, nama'
    );
    const siswas = await query('SELECT * FROM siswas');
    const gurus  = await query('SELECT * FROM gurus');
    const kelas  = await query('SELECT * FROM kelas');

    return NextResponse.json({ profiles, siswas, gurus, kelas });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil data akun.' }, { status: 500 });
  }
}

// POST /api/akun — buat akun baru
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { username, password, nama, role, status, nis, nip, id_kelas } = await req.json();

    if (!username?.trim()) return NextResponse.json({ error: 'Username wajib diisi.' }, { status: 400 });
    if (!password?.trim()) return NextResponse.json({ error: 'Password wajib diisi.' }, { status: 400 });
    if (!nama?.trim())     return NextResponse.json({ error: 'Nama wajib diisi.' }, { status: 400 });
    if (!role?.trim())     return NextResponse.json({ error: 'Role wajib diisi.' }, { status: 400 });
    if (!['siswa', 'guru', 'proktor', 'admin'].includes(role))
      return NextResponse.json({ error: 'Role tidak valid.' }, { status: 400 });

    // Cek username sudah ada
    const existing = await queryOne('SELECT id FROM profiles WHERE username = $1', [username]);
    if (existing) return NextResponse.json({ error: 'Username sudah digunakan.' }, { status: 409 });

    // Hash password
    const passwordHash = await hash(password, 10);

    // Insert profiles — simpan password_plain untuk ditampilkan di UI proktor
    const profile = await queryOne<{ id: string }>(
      `INSERT INTO profiles (username, password, password_plain, nama, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [username, passwordHash, password, nama, role, status ?? 'aktif']
    );

    if (!profile) throw new Error('Gagal membuat profil.');
    const userId = profile.id;

    // Buat profil siswa atau guru
    if (role === 'siswa' && nis && id_kelas) {
      await execute(
        'INSERT INTO siswas (nis, nama, id_kelas, id_user) VALUES ($1, $2, $3, $4)',
        [nis, nama, id_kelas, userId]
      );
    } else if (role === 'guru' && nip) {
      await execute(
        'INSERT INTO gurus (nip, nama, id_user) VALUES ($1, $2, $3)',
        [nip, nama, userId]
      );
    }

    return NextResponse.json({ ok: true, userId }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal membuat akun.' }, { status: 500 });
  }
}

// PATCH /api/akun — update status, nama, username, id_kelas, atau reset password
export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { userId, status, nama, id_kelas, password, username } = await req.json();

    if (!userId) return NextResponse.json({ error: 'userId wajib diisi.' }, { status: 400 });

    // Cek username baru tidak duplikat dengan akun lain
    if (username !== undefined) {
      if (!username.trim()) return NextResponse.json({ error: 'Username tidak boleh kosong.' }, { status: 400 });
      const conflict = await queryOne('SELECT id FROM profiles WHERE username = $1 AND id != $2', [username.trim(), userId]);
      if (conflict) return NextResponse.json({ error: 'Username sudah digunakan.' }, { status: 409 });
    }

    // Bangun UPDATE dinamis untuk profiles
    const setClauses: string[] = [];
    const params: unknown[]    = [];
    let idx = 1;

    if (status   !== undefined) { setClauses.push(`status = $${idx++}`);   params.push(status); }
    if (nama     !== undefined) { setClauses.push(`nama = $${idx++}`);     params.push(nama); }
    if (username !== undefined) { setClauses.push(`username = $${idx++}`); params.push(username.trim()); }
    if (password !== undefined) {
      const passwordHash = await hash(password, 10);
      setClauses.push(`password = $${idx++}`);
      params.push(passwordHash);
      // Simpan plain-text agar proktor bisa melihat password terbaru
      setClauses.push(`password_plain = $${idx++}`);
      params.push(password);
    }

    if (setClauses.length > 0) {
      params.push(userId);
      await execute(
        `UPDATE profiles SET ${setClauses.join(', ')} WHERE id = $${idx}`,
        params
      );
    }

    if (id_kelas !== undefined) {
      await execute('UPDATE siswas SET id_kelas = $1 WHERE id_user = $2', [id_kelas, userId]);
    }
    if (nama !== undefined) {
      await execute('UPDATE siswas SET nama = $1 WHERE id_user = $2', [nama, userId]);
      await execute('UPDATE gurus  SET nama = $1 WHERE id_user = $2', [nama, userId]);
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal update akun.' }, { status: 500 });
  }
}

// DELETE /api/akun?id=xxx&type=siswa|guru
export async function DELETE(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { searchParams } = new URL(req.url);
    const id   = searchParams.get('id');
    const type = searchParams.get('type'); // 'siswa' | 'guru'

    if (!id || !type) return NextResponse.json({ error: 'id dan type wajib diisi.' }, { status: 400 });

    const table = type === 'siswa' ? 'siswas' : 'gurus';

    // Ambil id_user
    const row = await queryOne<{ id_user: string }>(
      `SELECT id_user FROM ${table} WHERE id = $1`,
      [id]
    );
    if (!row) return NextResponse.json({ error: 'Data tidak ditemukan.' }, { status: 404 });

    // Hapus siswa/guru dulu, lalu profiles (CASCADE akan hapus siswa/guru otomatis tapi explicit lebih aman)
    await execute(`DELETE FROM ${table} WHERE id = $1`, [id]);
    await execute('DELETE FROM profiles WHERE id = $1', [row.id_user]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal menghapus akun.' }, { status: 500 });
  }
}
