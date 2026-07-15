import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/ujian/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const { id } = await params;
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from('ujians')
      .select(`*, ujian_kelas ( kelas_id )`)
      .eq('id', id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });

    return NextResponse.json({
      ...data,
      kelas_ids: data.ujian_kelas.map((k: { kelas_id: string }) => k.kelas_id),
      ujian_kelas: undefined,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil ujian.' }, { status: 500 });
  }
}

// PUT /api/ujian/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['guru', 'proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { id } = await params;
    const supabase = createSupabaseServerClient();
    const body = await req.json();
    const { kelas_ids, ...ujianData } = body;

    const { error } = await supabase.from('ujians').update(ujianData).eq('id', id);
    if (error) throw error;

    // Update relasi kelas jika dikirim
    if (kelas_ids !== undefined) {
      // A-07: delete semua lama dulu, lalu insert baru
      // Insert dilakukan setelah delete agar tidak terjadi duplicate key error
      const { error: delErr } = await supabase.from('ujian_kelas').delete().eq('ujian_id', id);
      if (delErr) throw delErr;
      if (kelas_ids.length) {
        const newRows = kelas_ids.map((kelas_id: string) => ({ ujian_id: id, kelas_id }));
        const { error: insertErr } = await supabase.from('ujian_kelas').insert(newRows);
        if (insertErr) throw insertErr;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal update ujian.' }, { status: 500 });
  }
}

// DELETE /api/ujian/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['guru', 'proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { id } = await params;
    const supabase = createSupabaseServerClient();

    // Cek apakah ada jadwal aktif
    const { data: jadwal } = await supabase
      .from('jadwal_ujians')
      .select('id')
      .eq('id_ujian', id)
      .eq('status_publikasi', 'Published')
      .limit(1);

    if (jadwal && jadwal.length > 0) {
      return NextResponse.json(
        { error: 'Tidak bisa hapus ujian yang masih memiliki jadwal aktif.' },
        { status: 409 }
      );
    }

    // Cascade delete: soal dan ujian_kelas otomatis terhapus via FK
    const { error } = await supabase.from('ujians').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal menghapus ujian.' }, { status: 500 });
  }
}
