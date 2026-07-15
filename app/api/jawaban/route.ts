import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/jawaban?sessionId=xxx — ambil semua jawaban dalam session
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const supabase = createSupabaseServerClient();
    const sessionId = new URL(req.url).searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId wajib diisi.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('jawabans')
      .select('*')
      .eq('id_session', sessionId);

    if (error) throw error;
    return NextResponse.json(data ?? []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil jawaban.' }, { status: 500 });
  }
}

// POST /api/jawaban — upsert jawaban siswa
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const supabase = createSupabaseServerClient();
    const { sessionId, soalId, jawaban_siswa, status_soal } = await req.json();

    const { error } = await supabase
      .from('jawabans')
      .upsert(
        {
          id_session:    sessionId,
          id_soal:       soalId,
          jawaban_siswa: jawaban_siswa ?? null,
          status_soal:   status_soal ?? 'belum',
          waktu_jawab:   new Date().toISOString(),
        },
        { onConflict: 'id_session,id_soal' }
      );

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal menyimpan jawaban.' }, { status: 500 });
  }
}
