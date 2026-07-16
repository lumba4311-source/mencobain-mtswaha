import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
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

// GET /api/session?siswaId=xxx&jadwalId=xxx
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const siswaId  = searchParams.get('siswaId');
    const jadwalId = searchParams.get('jadwalId');

    if (!siswaId || !jadwalId)
      return NextResponse.json({ error: 'siswaId dan jadwalId wajib diisi.' }, { status: 400 });

    // Siswa hanya boleh melihat session miliknya sendiri
    if (auth.role === 'siswa') {
      const siswa = await queryOne<{ id: string }>(
        'SELECT id FROM siswas WHERE id_user = $1 LIMIT 1',
        [auth.id]
      );
      if (!siswa || siswa.id !== siswaId)
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const session = await queryOne(
      'SELECT * FROM session_ujians WHERE id_siswa = $1 AND id_jadwal = $2 LIMIT 1',
      [siswaId, jadwalId]
    );

    return NextResponse.json(session ?? null);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil session.' }, { status: 500 });
  }
}

// POST /api/session — buat session baru
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const { siswaId, jadwalId } = await req.json();

    if (!siswaId || !jadwalId)
      return NextResponse.json({ error: 'siswaId dan jadwalId wajib diisi.' }, { status: 400 });

    // Cek duplikat session
    const existing = await queryOne<{ id: string }>(
      'SELECT id FROM session_ujians WHERE id_siswa = $1 AND id_jadwal = $2 LIMIT 1',
      [siswaId, jadwalId]
    );

    if (existing) {
      const existingFull = await queryOne(
        'SELECT * FROM session_ujians WHERE id = $1',
        [existing.id]
      );
      return NextResponse.json(existingFull, { status: 200 });
    }

    // Ambil jadwal + ujian
    const jadwal = await queryOne<{
      id: string; durasi_menit: number;
      ujians: { id: string; acak_soal: boolean; acak_opsi: boolean };
    }>(
      `SELECT j.*, row_to_json(u.*) AS ujians
       FROM jadwal_ujians j
       JOIN ujians u ON u.id = j.id_ujian
       WHERE j.id = $1`,
      [jadwalId]
    );

    if (!jadwal) return NextResponse.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 });

    const ujian = jadwal.ujians;

    // Ambil soal
    const soals = await query<{ id: string }>(
      'SELECT id FROM soals WHERE id_ujian = $1',
      [ujian.id]
    );

    const soalIds = soals.map(s => s.id);
    const orderedSoalIds = ujian.acak_soal ? shuffle(soalIds) : soalIds;

    // Buat urutan opsi per soal
    const opsiKeys = ['A', 'B', 'C', 'D', 'E'];
    const urutanOpsi: Record<string, string[]> = {};
    soalIds.forEach(id => {
      urutanOpsi[id] = ujian.acak_opsi ? shuffle([...opsiKeys]) : [...opsiKeys];
    });

    const now      = new Date();
    const durasi   = jadwal.durasi_menit ?? 90;
    const deadline = new Date(now.getTime() + durasi * 60 * 1000);

    const session = await queryOne(
      `INSERT INTO session_ujians
         (id_jadwal, id_siswa, urutan_soal, urutan_opsi, deadline, sisa_waktu, status, started_at)
       VALUES ($1, $2, $3, $4, $5, $6, 'berlangsung', $7)
       RETURNING *`,
      [
        jadwalId, siswaId,
        JSON.stringify(orderedSoalIds),
        JSON.stringify(urutanOpsi),
        deadline.toISOString(),
        durasi * 60,
        now.toISOString(),
      ]
    );

    if (!session) throw new Error('Gagal membuat session.');
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
    const { sessionId, status, sisa_waktu } = await req.json();

    if (!sessionId)
      return NextResponse.json({ error: 'sessionId wajib diisi.' }, { status: 400 });

    // Ambil session untuk ownership check
    const session = await queryOne<{ id: string; id_siswa: string }>(
      'SELECT id, id_siswa FROM session_ujians WHERE id = $1 LIMIT 1',
      [sessionId]
    );
    if (!session)
      return NextResponse.json({ error: 'Session tidak ditemukan.' }, { status: 404 });

    // Siswa hanya boleh update session miliknya sendiri
    // Proktor/admin boleh update semua (untuk force submit, dll)
    if (auth.role === 'siswa') {
      const siswa = await queryOne<{ id: string }>(
        'SELECT id FROM siswas WHERE id_user = $1 LIMIT 1',
        [auth.id]
      );
      if (!siswa || siswa.id !== session.id_siswa)
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

      // Siswa hanya boleh update sisa_waktu dan status 'berlangsung'/'selesai'
      // Tidak boleh set status ke 'force_submit' sendiri
      if (status !== undefined && !['berlangsung', 'selesai'].includes(status))
        return NextResponse.json({ error: 'Status tidak valid.' }, { status: 400 });
    }

    const setClauses: string[] = [];
    const params: unknown[]    = [];
    let idx = 1;

    if (status     !== undefined) { setClauses.push(`status = $${idx++}`);     params.push(status); }
    if (sisa_waktu !== undefined) { setClauses.push(`sisa_waktu = $${idx++}`); params.push(sisa_waktu); }

    if (setClauses.length === 0)
      return NextResponse.json({ ok: true });

    params.push(sessionId);
    await execute(
      `UPDATE session_ujians SET ${setClauses.join(', ')} WHERE id = $${idx}`,
      params
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal update session.' }, { status: 500 });
  }
}
