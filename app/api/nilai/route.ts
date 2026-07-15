import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/nilai?siswaId=xxx         — histori nilai siswa
// GET /api/nilai?jadwalId=xxx        — nilai semua siswa dalam jadwal (proktor/guru)
// GET /api/nilai?sessionId=xxx       — nilai untuk satu session
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const supabase = createSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const siswaId   = searchParams.get('siswaId');
    const jadwalId  = searchParams.get('jadwalId');
    const sessionId = searchParams.get('sessionId');

    // A-08: Wajib ada minimal satu parameter — cegah return semua data nilai
    if (!siswaId && !jadwalId && !sessionId) {
      return NextResponse.json({ error: 'Minimal satu parameter diperlukan: siswaId, jadwalId, atau sessionId.' }, { status: 400 });
    }

    let query = supabase.from('nilai').select('*');

    if (siswaId)   query = query.eq('id_siswa',   siswaId);
    if (jadwalId)  query = query.eq('id_jadwal',  jadwalId);
    if (sessionId) query = query.eq('id_session', sessionId).limit(1);

    const { data, error } = await query.order('submitted_at', { ascending: false });
    if (error) throw error;

    if (sessionId) return NextResponse.json(data?.[0] ?? null);
    return NextResponse.json(data ?? []);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil nilai.' }, { status: 500 });
  }
}

// POST /api/nilai — submit ujian dan hitung nilai
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const supabase = createSupabaseServerClient();
    const { sessionId } = await req.json();

    // Ambil session
    const { data: session, error: sesErr } = await supabase
      .from('session_ujians')
      .select('*, jadwal_ujians(*)')
      .eq('id', sessionId)
      .single();

    if (sesErr || !session) {
      return NextResponse.json({ error: 'Session tidak ditemukan.' }, { status: 404 });
    }

    // BUG FIX: guard duplikat insert jika session sudah di-submit sebelumnya
    const { data: existing } = await supabase
      .from('nilai')
      .select('id')
      .eq('id_session', sessionId)
      .maybeSingle();

    if (existing) {
      // Nilai sudah ada, return data yang ada tanpa insert ulang
      const { data: existingNilai } = await supabase
        .from('nilai')
        .select('*')
        .eq('id_session', sessionId)
        .single();
      return NextResponse.json(existingNilai);
    }

    // Ambil semua soal ujian + jawaban siswa
    const jadwalId = session.id_jadwal as string;
    const siswaId  = session.id_siswa as string;

    const { data: soals } = await supabase
      .from('soals')
      .select('id, jawaban_benar, bobot')
      .eq('id_ujian', (session.jadwal_ujians as { id_ujian: string }).id_ujian);

    const { data: jawabans } = await supabase
      .from('jawabans')
      .select('id_soal, jawaban_siswa')
      .eq('id_session', sessionId);

    const jawabanMap = new Map((jawabans ?? []).map((j) => [j.id_soal, j.jawaban_siswa]));

    let jumlah_benar = 0;
    let jumlah_salah = 0;
    let jumlah_kosong = 0;
    let total_bobot = 0;

    // Hitung nilai + kumpulkan update benar_salah
    const updates: Promise<unknown>[] = [];

    for (const soal of soals ?? []) {
      const jawaban = jawabanMap.get(soal.id);
      if (!jawaban) {
        jumlah_kosong++;
      } else if (jawaban === soal.jawaban_benar) {
        jumlah_benar++;
        total_bobot += soal.bobot;
      } else {
        jumlah_salah++;
      }

      // P1: kumpulkan semua update, kirim paralel — bukan sequential await per soal
      // Cast ke Promise<unknown> karena PostgrestFilterBuilder adalah thenable tapi bukan Promise
      updates.push(
        supabase
          .from('jawabans')
          .update({ benar_salah: jawaban ? jawaban === soal.jawaban_benar : null })
          .eq('id_session', sessionId)
          .eq('id_soal', soal.id) as unknown as Promise<unknown>
      );
    }

    // Kirim semua update benar_salah sekaligus secara paralel
    await Promise.all(updates);

    const totalSoal = (soals ?? []).length;
    const nilai = totalSoal > 0 ? Math.round((jumlah_benar / totalSoal) * 100) : 0;
    const lulus = true; // KKM tidak digunakan

    // Insert nilai
    const { data: hasilNilai, error: nilaiErr } = await supabase
      .from('nilai')
      .insert({
        id_session:     sessionId,
        id_siswa:       siswaId,
        id_jadwal:      jadwalId,
        jumlah_benar,
        jumlah_salah,
        jumlah_kosong,
        nilai,
        lulus,
        submitted_at:   new Date().toISOString(),
      })
      .select()
      .single();

    if (nilaiErr) throw nilaiErr;

    // Update status session menjadi selesai
    await supabase
      .from('session_ujians')
      .update({ status: 'selesai' })
      .eq('id', sessionId);

    return NextResponse.json(hasilNilai, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal submit ujian.' }, { status: 500 });
  }
}
