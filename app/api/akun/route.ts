import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/akun — semua user (proktor)
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin', 'guru', 'siswa'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const supabase = createSupabaseServerClient();

    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, username, nama, role, status, password')
      .order('role')
      .order('nama');

    if (error) throw error;

    // Ambil data siswa dan guru sekaligus
    const { data: siswas } = await supabase.from('siswas').select('*');
    const { data: gurus }  = await supabase.from('gurus').select('*');
    const { data: kelas }  = await supabase.from('kelas').select('*');

    return NextResponse.json({ profiles, siswas, gurus, kelas });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil data akun.' }, { status: 500 });
  }
}

// POST /api/akun — buat akun baru (proktor)
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const supabase = createSupabaseServerClient();
    const { username, password, nama, role, status, nis, nip, id_kelas } = await req.json();

    // A-09: Validasi field wajib sebelum hit Supabase Auth
    if (!username?.trim()) return NextResponse.json({ error: 'Username wajib diisi.' }, { status: 400 });
    if (!password?.trim()) return NextResponse.json({ error: 'Password wajib diisi.' }, { status: 400 });
    if (!nama?.trim())     return NextResponse.json({ error: 'Nama wajib diisi.' }, { status: 400 });
    if (!role?.trim())     return NextResponse.json({ error: 'Role wajib diisi.' }, { status: 400 });
    if (!['siswa', 'guru', 'proktor', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Role tidak valid.' }, { status: 400 });
    }

    // Buat user di Supabase Auth
    const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
      email:    `${username}@umbk.local`,
      password,
      email_confirm: true,
      user_metadata: { username, nama, role, status: status ?? 'aktif' },
    });

    if (authErr || !authData.user) {
      return NextResponse.json({ error: authErr?.message ?? 'Gagal membuat akun.' }, { status: 400 });
    }

    const userId = authData.user.id;

    // Simpan password plaintext ke profiles agar bisa ditampilkan di kelola akun
    await supabase.from('profiles').update({ password }).eq('id', userId);

    // Buat profil siswa atau guru
    if (role === 'siswa' && nis && id_kelas) {
      await supabase.from('siswas').insert({ nis, nama, id_kelas, id_user: userId });
    } else if (role === 'guru' && nip) {
      await supabase.from('gurus').insert({ nip, nama, id_user: userId });
    }

    return NextResponse.json({ ok: true, userId }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal membuat akun.' }, { status: 500 });
  }
}

// PATCH /api/akun — update status, nama, id_kelas, atau reset password
export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const supabase = createSupabaseServerClient();
    const { userId, status, nama, id_kelas, password } = await req.json();

    // Update profiles table
    const profileUpdate: Record<string, string> = {};
    if (status   !== undefined) profileUpdate.status   = status;
    if (nama     !== undefined) profileUpdate.nama     = nama;
    if (password !== undefined) profileUpdate.password = password;

    if (Object.keys(profileUpdate).length > 0) {
      const { error } = await supabase
        .from('profiles')
        .update(profileUpdate)
        .eq('id', userId);
      if (error) throw error;
    }

    // Update kelas di tabel siswas
    if (id_kelas !== undefined) {
      await supabase.from('siswas').update({ id_kelas }).eq('id_user', userId);
    }

    // Update nama di siswas/gurus jika ada
    if (nama !== undefined) {
      await supabase.from('siswas').update({ nama }).eq('id_user', userId);
      await supabase.from('gurus').update({ nama }).eq('id_user', userId);
    }

    // Reset password di Supabase Auth
    if (password !== undefined) {
      const { error: authErr } = await supabase.auth.admin.updateUserById(userId, { password });
      if (authErr) throw authErr;
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal update akun.' }, { status: 500 });
  }
}

// DELETE /api/akun?id=xxx&type=siswa|guru — hapus akun
export async function DELETE(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const supabase = createSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const id   = searchParams.get('id');
    const type = searchParams.get('type'); // 'siswa' | 'guru'

    if (!id || !type) {
      return NextResponse.json({ error: 'id dan type wajib diisi.' }, { status: 400 });
    }

    const table = type === 'siswa' ? 'siswas' : 'gurus';

    // Ambil id_user dulu sebelum hapus
    const { data: profile, error: fetchErr } = await supabase
      .from(table)
      .select('id_user')
      .eq('id', id)
      .single();

    if (fetchErr || !profile) {
      return NextResponse.json({ error: 'Data tidak ditemukan.' }, { status: 404 });
    }

    // Hapus dari tabel siswa/guru
    const { error: deleteErr } = await supabase.from(table).delete().eq('id', id);
    if (deleteErr) throw deleteErr;

    // Hapus dari Supabase Auth
    const { error: authErr } = await supabase.auth.admin.deleteUser(profile.id_user);
    if (authErr) throw authErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal menghapus akun.' }, { status: 500 });
  }
}
