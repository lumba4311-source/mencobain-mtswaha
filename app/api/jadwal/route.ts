import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/jadwal?siswaId=xxx  — jadwal aktif untuk siswa
// GET /api/jadwal              — semua jadwal (proktor)
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const supabase = createSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const siswaId = searchParams.get('siswaId');

    if (siswaId) {
      // Jadwal Published yang include siswa ini
      const { data: relasi } = await supabase
        .from('jadwal_siswa')
        .select('jadwal_id')
        .eq('siswa_id', siswaId);

      const jadwalIds = (relasi ?? []).map((r) => r.jadwal_id);
      if (!jadwalIds.length) return NextResponse.json([]);

      const { data, error } = await supabase
        .from('jadwal_ujians')
        .select(`*, jadwal_siswa ( siswa_id )`)
        .in('id', jadwalIds)
        .eq('status_publikasi', 'Published');

      if (error) throw error;
      return NextResponse.json(
        (data ?? []).map((j) => ({
          ...j,
          siswa_ids: j.jadwal_siswa.map((s: { siswa_id: string }) => s.siswa_id),
          jadwal_siswa: undefined,
        }))
      );
    }

    // Semua jadwal (proktor)
    const { data, error } = await supabase
      .from('jadwal_ujians')
      .select(`*, jadwal_siswa ( siswa_id )`)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return NextResponse.json(
      (data ?? []).map((j) => ({
        ...j,
        siswa_ids: j.jadwal_siswa.map((s: { siswa_id: string }) => s.siswa_id),
        jadwal_siswa: undefined,
      }))
    );
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil jadwal.' }, { status: 500 });
  }
}

// POST /api/jadwal — buat jadwal baru
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const supabase = createSupabaseServerClient();
    const { id_ujian, max_capacity, durasi_menit, status_publikasi, siswa_ids } = await req.json();

    const { data: jadwal, error } = await supabase
      .from('jadwal_ujians')
      .insert({ id_ujian, max_capacity, durasi_menit, status_publikasi: status_publikasi ?? 'Draft' })
      .select()
      .single();

    if (error || !jadwal) throw error;

    if (siswa_ids?.length) {
      await supabase.from('jadwal_siswa').insert(
        siswa_ids.map((siswa_id: string) => ({ jadwal_id: jadwal.id, siswa_id }))
      );
    }

    return NextResponse.json({ ...jadwal, siswa_ids: siswa_ids ?? [] }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal membuat jadwal.' }, { status: 500 });
  }
}
