import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/ujian?guruId=xxx  — list ujian (guru hanya miliknya, proktor semua)
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const supabase = createSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const guruId = searchParams.get('guruId');

    let query = supabase
      .from('ujians')
      .select(`
        *,
        ujian_kelas ( kelas_id ),
        gurus ( nama ),
        soals ( id )
      `)
      .order('created_at', { ascending: false });

    if (guruId) query = query.eq('id_guru', guruId);

    const { data, error } = await query;
    if (error) throw error;

    // Flatten kelas_ids dan hitung soal_count dari relasi
    const ujians = (data ?? []).map((u) => ({
      ...u,
      kelas_ids:  u.ujian_kelas.map((k: { kelas_id: string }) => k.kelas_id),
      soal_count: Array.isArray(u.soals) ? u.soals.length : 0,
      ujian_kelas: undefined,
      soals:       undefined,
    }));

    return NextResponse.json(ujians);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil data ujian.' }, { status: 500 });
  }
}

// POST /api/ujian — buat ujian baru
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['guru', 'proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const supabase = createSupabaseServerClient();
    const body = await req.json();
    const { nama_ujian, id_guru, jenis_ujian, durasi, acak_soal, acak_opsi, tampil_hasil, kelas_ids } = body;

    // Insert ujian
    const { data: ujian, error } = await supabase
      .from('ujians')
      .insert({ nama_ujian, id_guru, jenis_ujian, durasi, acak_soal, acak_opsi, tampil_hasil })
      .select()
      .single();

    if (error || !ujian) throw error;

    // Insert relasi kelas
    if (kelas_ids?.length) {
      await supabase.from('ujian_kelas').insert(
        kelas_ids.map((kelas_id: string) => ({ ujian_id: ujian.id, kelas_id }))
      );
    }

    return NextResponse.json({ ...ujian, kelas_ids: kelas_ids ?? [] }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal membuat ujian.' }, { status: 500 });
  }
}
