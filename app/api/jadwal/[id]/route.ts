import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/jadwal/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const { id } = await params;
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from('jadwal_ujians')
      .select('*, ujians(*), jadwal_siswa(siswa_id)')
      .eq('id', id)
      .single();

    if (error || !data) return NextResponse.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 });
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil jadwal.' }, { status: 500 });
  }
}

// PUT /api/jadwal/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { id } = await params;
    const supabase = createSupabaseServerClient();
    const { siswa_ids, ...jadwalData } = await req.json();

    const { error } = await supabase.from('jadwal_ujians').update(jadwalData).eq('id', id);
    if (error) throw error;

    if (siswa_ids !== undefined) {
      // A-07: delete semua lama dulu, lalu insert baru
      // Insert dilakukan setelah delete agar tidak terjadi duplicate key error
      const { error: delErr } = await supabase.from('jadwal_siswa').delete().eq('jadwal_id', id);
      if (delErr) throw delErr;
      if (siswa_ids.length) {
        const newRows = siswa_ids.map((siswa_id: string) => ({ jadwal_id: id, siswa_id }));
        const { error: insertErr } = await supabase.from('jadwal_siswa').insert(newRows);
        if (insertErr) throw insertErr;
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal update jadwal.' }, { status: 500 });
  }
}

// DELETE /api/jadwal/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { id } = await params;
    const supabase = createSupabaseServerClient();

    // Ambil semua session yang terkait jadwal ini
    const { data: sessions } = await supabase
      .from('session_ujians')
      .select('id')
      .eq('id_jadwal', id);

    const sessionIds = (sessions ?? []).map((s) => s.id);

    if (sessionIds.length) {
      // Hapus jawaban dulu (FK ke session_ujians)
      await supabase.from('jawabans').delete().in('id_session', sessionIds);
      // Hapus nilai (FK ke session_ujians)
      await supabase.from('nilai').delete().in('id_session', sessionIds);
      // Hapus session
      await supabase.from('session_ujians').delete().in('id', sessionIds);
    }

    // Hapus relasi jadwal_siswa
    await supabase.from('jadwal_siswa').delete().eq('jadwal_id', id);

    // Hapus jadwal
    const { error } = await supabase.from('jadwal_ujians').delete().eq('id', id);
    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal menghapus jadwal.' }, { status: 500 });
  }
}
