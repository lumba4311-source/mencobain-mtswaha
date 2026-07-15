import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/monitoring?jadwalId=xxx — data monitoring proktor
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const supabase = createSupabaseServerClient();
    const jadwalId = new URL(req.url).searchParams.get('jadwalId');

    if (!jadwalId) {
      return NextResponse.json({ error: 'jadwalId wajib diisi.' }, { status: 400 });
    }

    // Ambil jadwal + ujian
    const { data: jadwal } = await supabase
      .from('jadwal_ujians')
      .select('*, ujians(durasi), jadwal_siswa(siswa_id)')
      .eq('id', jadwalId)
      .single();

    if (!jadwal) return NextResponse.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 });

    const siswaIds = (jadwal.jadwal_siswa as { siswa_id: string }[]).map((s) => s.siswa_id);
    if (!siswaIds.length) return NextResponse.json([]);

    // Ambil data siswa — P5: kolom spesifik, hindari foto/data besar yang tidak dipakai
    const { data: siswas } = await supabase
      .from('siswas')
      .select('id, nama, nis, id_kelas')
      .in('id', siswaIds);

    // Ambil semua session dalam jadwal ini — P5: kolom spesifik, skip urutan_soal/urutan_opsi
    const { data: sessions } = await supabase
      .from('session_ujians')
      .select('id, id_siswa, id_jadwal, status, sisa_waktu, deadline, submitted_at')
      .eq('id_jadwal', jadwalId);

    // Ambil jumlah jawaban per session
    const sessionIds = (sessions ?? []).map((s) => s.id);
    let jawabanCounts: Record<string, number> = {};

    if (sessionIds.length) {
      const { data: jawabans } = await supabase
        .from('jawabans')
        .select('id_session, jawaban_siswa')
        .in('id_session', sessionIds)
        .not('jawaban_siswa', 'is', null);

      (jawabans ?? []).forEach((j) => {
        jawabanCounts[j.id_session] = (jawabanCounts[j.id_session] ?? 0) + 1;
      });
    }

    // Hitung total soal — ambil id_ujian dari jadwal langsung
    const { count: totalSoal } = await supabase
      .from('soals')
      .select('id', { count: 'exact', head: true })
      .eq('id_ujian', (jadwal as { id_ujian: string }).id_ujian ?? '');

    const result = (siswas ?? []).map((siswa) => {
      const session = (sessions ?? []).find((s) => s.id_siswa === siswa.id);
      const jumlah_dijawab = session ? (jawabanCounts[session.id] ?? 0) : 0;
      const progress_persen = totalSoal ? Math.round((jumlah_dijawab / totalSoal) * 100) : 0;

      return {
        siswa,
        session: session ?? null,
        jumlah_dijawab,
        progress_persen,
        // BUG FIX: sertakan durasiBatas agar timer di ProktorMonitoringPage bisa berjalan
        durasiBatas: (jadwal.ujians as { durasi: number } | null)?.durasi ?? 90,
      };
    });

    return NextResponse.json(result);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil data monitoring.' }, { status: 500 });
  }
}

// POST /api/monitoring/force-submit — proktor paksa submit siswa
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const supabase = createSupabaseServerClient();
    const { sessionId } = await req.json();

    // A-06: Validasi sessionId wajib ada — tanpa ini update bisa kena semua baris
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId wajib diisi.' }, { status: 400 });
    }

    await supabase
      .from('session_ujians')
      .update({ status: 'force_submit' })
      .eq('id', sessionId);

    // Hitung dan simpan nilai
    const nilaiRes = await fetch(new URL('/api/nilai', req.url).toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId }),
    });

    const nilai = await nilaiRes.json();
    return NextResponse.json({ ok: true, nilai });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal force submit.' }, { status: 500 });
  }
}
