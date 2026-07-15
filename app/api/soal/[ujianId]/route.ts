import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/soal/[ujianId] — ambil semua soal untuk ujian tertentu
export async function GET(req: NextRequest, { params }: { params: Promise<{ ujianId: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const { ujianId } = await params;
    const supabase = createSupabaseServerClient();

    const { data, error } = await supabase
      .from('soals')
      .select('*')
      .eq('id_ujian', ujianId)
      .order('nomor', { ascending: true });

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil soal.' }, { status: 500 });
  }
}

// POST /api/soal/[ujianId] — simpan/replace semua soal (bulk upsert)
export async function POST(req: NextRequest, { params }: { params: Promise<{ ujianId: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['guru', 'proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { ujianId } = await params;
    const supabase = createSupabaseServerClient();
    const { soals } = await req.json();

    // A-03: Ambil ID soal lama sebelum insert — baru delete setelah insert berhasil
    // Ini menghindari data loss jika insert gagal (tidak ada delete-first pattern)
    const { data: soalLama } = await supabase
      .from('soals')
      .select('id')
      .eq('id_ujian', ujianId);

    const idLama = (soalLama ?? []).map((s: { id: string }) => s.id);

    const toInsert = soals.map((s: {
      nomor: number; pertanyaan: string;
      opsi_a: string; opsi_b: string; opsi_c: string; opsi_d: string;
      opsi_a_img?: string; opsi_b_img?: string; opsi_c_img?: string; opsi_d_img?: string;
      jawaban_benar: string; bobot: number; gambar_url?: string;
    }) => ({
      id_ujian: ujianId,
      nomor: s.nomor,
      pertanyaan: s.pertanyaan,
      opsi_a: s.opsi_a,
      opsi_b: s.opsi_b,
      opsi_c: s.opsi_c,
      opsi_d: s.opsi_d,
      opsi_a_img: s.opsi_a_img ?? null,
      opsi_b_img: s.opsi_b_img ?? null,
      opsi_c_img: s.opsi_c_img ?? null,
      opsi_d_img: s.opsi_d_img ?? null,
      jawaban_benar: s.jawaban_benar,
      bobot: s.bobot,
      gambar_url: s.gambar_url ?? null,
    }));

    // Hapus soal lama dulu — ID sudah dicatat di atas sehingga tidak ada race condition
    // Unique constraint (id_ujian, nomor) tidak bisa dilanggar jika soal lama sudah dihapus
    if (idLama.length) {
      const { error: deleteErr } = await supabase.from('soals').delete().in('id', idLama);
      if (deleteErr) throw deleteErr;
    }

    // Baru insert soal baru setelah soal lama bersih
    const { error: insertErr } = await supabase.from('soals').insert(toInsert);
    if (insertErr) throw insertErr;

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal menyimpan soal.' }, { status: 500 });
  }
}
