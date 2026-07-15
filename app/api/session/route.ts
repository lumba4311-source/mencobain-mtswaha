import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase';
import { getAuthUser } from '@/lib/apiAuth';

// Fisher-Yates shuffle
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// GET /api/session?siswaId=xxx&jadwalId=xxx — ambil session yang ada
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const supabase = createSupabaseServerClient();
    const { searchParams } = new URL(req.url);
    const siswaId  = searchParams.get('siswaId');
    const jadwalId = searchParams.get('jadwalId');

    if (!siswaId || !jadwalId) {
      return NextResponse.json({ error: 'siswaId dan jadwalId wajib diisi.' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('session_ujians')
      .select('*')
      .eq('id_siswa', siswaId)
      .eq('id_jadwal', jadwalId)
      .single();

    if (error || !data) return NextResponse.json(null);
    return NextResponse.json(data);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil session.' }, { status: 500 });
  }
}

// POST /api/session — buat session baru untuk siswa
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const supabase = createSupabaseServerClient();
    const { siswaId, jadwalId } = await req.json();

    // A-04: Validasi input wajib
    if (!siswaId || !jadwalId) {
      return NextResponse.json({ error: 'siswaId dan jadwalId wajib diisi.' }, { status: 400 });
    }

    // A-04: Cek duplikat session — hindari siswa masuk dua kali
    const { data: existing } = await supabase
      .from('session_ujians')
      .select('id, status')
      .eq('id_siswa', siswaId)
      .eq('id_jadwal', jadwalId)
      .maybeSingle();

    if (existing) {
      // Session sudah ada — return session yang ada tanpa buat baru
      const { data: existingFull } = await supabase
        .from('session_ujians')
        .select('*')
        .eq('id', existing.id)
        .single();
      return NextResponse.json(existingFull, { status: 200 });
    }

    // Ambil jadwal + ujian
    const { data: jadwal, error: jadwalErr } = await supabase
      .from('jadwal_ujians')
      .select('*, ujians(*)')
      .eq('id', jadwalId)
      .single();

    if (jadwalErr || !jadwal) {
      return NextResponse.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 });
    }

    const ujian = jadwal.ujians as { id: string; acak_soal: boolean; acak_opsi: boolean };

    // Ambil soal
    const { data: soals } = await supabase
      .from('soals')
      .select('id')
      .eq('id_ujian', ujian.id);

    const soalIds = (soals ?? []).map((s) => s.id);
    const orderedSoalIds = ujian.acak_soal ? shuffle(soalIds) : soalIds;

    // Buat urutan opsi per soal
    const opsiKeys = ['A', 'B', 'C', 'D', 'E'];
    const urutanOpsi: Record<string, string[]> = {};
    soalIds.forEach((id) => {
      urutanOpsi[id] = ujian.acak_opsi ? shuffle([...opsiKeys]) : [...opsiKeys];
    });

    const now     = new Date();
    const durasi  = (jadwal.durasi_menit as number) ?? 90;
    const deadline = new Date(now.getTime() + durasi * 60 * 1000);

    const { data: session, error } = await supabase
      .from('session_ujians')
      .insert({
        id_jadwal:    jadwalId,
        id_siswa:     siswaId,
        urutan_soal:  orderedSoalIds,
        urutan_opsi:  urutanOpsi,
        deadline:     deadline.toISOString(),
        sisa_waktu:   durasi * 60,
        status:       'berlangsung',
        started_at:   now.toISOString(),
      })
      .select()
      .single();

    if (error || !session) throw error;
    return NextResponse.json(session, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal membuat session.' }, { status: 500 });
  }
}

// PATCH /api/session — update status/sisa_waktu
export async function PATCH(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const supabase = createSupabaseServerClient();
    const { sessionId, status, sisa_waktu } = await req.json();

    // A-05: Validasi sessionId wajib ada
    if (!sessionId) {
      return NextResponse.json({ error: 'sessionId wajib diisi.' }, { status: 400 });
    }

    const update: Record<string, unknown> = {};
    if (status      !== undefined) update.status      = status;
    if (sisa_waktu  !== undefined) update.sisa_waktu  = sisa_waktu;

    const { error } = await supabase
      .from('session_ujians')
      .update(update)
      .eq('id', sessionId);

    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal update session.' }, { status: 500 });
  }
}
