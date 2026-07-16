import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/nilai?siswaId=xxx | jadwalId=xxx | sessionId=xxx
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const siswaId   = searchParams.get('siswaId');
    const jadwalId  = searchParams.get('jadwalId');
    const sessionId = searchParams.get('sessionId');

    if (!siswaId && !jadwalId && !sessionId)
      return NextResponse.json(
        { error: 'Minimal satu parameter diperlukan: siswaId, jadwalId, atau sessionId.' },
        { status: 400 }
      );

    // Siswa hanya boleh melihat nilai miliknya sendiri
    if (auth.role === 'siswa') {
      const siswa = await queryOne<{ id: string }>(
        'SELECT id FROM siswas WHERE id_user = $1 LIMIT 1',
        [auth.id]
      );
      if (!siswa) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
      // Jika siswaId disuplai, pastikan milik siswa yang login
      if (siswaId && siswaId !== siswa.id)
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const conditions: string[] = [];
    const params: unknown[]    = [];
    let idx = 1;

    if (siswaId)   { conditions.push(`id_siswa = $${idx++}`);   params.push(siswaId); }
    if (jadwalId)  { conditions.push(`id_jadwal = $${idx++}`);  params.push(jadwalId); }
    if (sessionId) { conditions.push(`id_session = $${idx++}`); params.push(sessionId); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limitClause = sessionId ? 'LIMIT 1' : '';

    const rows = await query(
      `SELECT * FROM nilai ${where} ORDER BY submitted_at DESC ${limitClause}`,
      params
    );

    if (sessionId) return NextResponse.json(rows[0] ?? null);
    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil nilai.' }, { status: 500 });
  }
}

/**
 * Hitung dan simpan nilai untuk sessionId yang diberikan.
 * Dapat dipanggil langsung dari route lain (monitoring/force submit)
 * tanpa membuat HTTP request internal.
 *
 * Return: row nilai yang baru diinsert, atau existing bila sudah ada.
 */
export async function hitungDanSimpanNilai(sessionId: string): Promise<Record<string, unknown>> {
  // Ambil session + jadwal
  const session = await queryOne<{
    id: string; id_jadwal: string; id_siswa: string;
    jadwal_ujians: { id_ujian: string };
  }>(
    `SELECT s.*, row_to_json(j.*) AS jadwal_ujians
     FROM session_ujians s
     JOIN jadwal_ujians j ON j.id = s.id_jadwal
     WHERE s.id = $1`,
    [sessionId]
  );

  if (!session) throw new Error('Session tidak ditemukan.');

  const jadwalId = session.id_jadwal;
  const siswaId  = session.id_siswa;
  const idUjian  = session.jadwal_ujians.id_ujian;

  // Ambil semua soal
  const soals = await query<{ id: string; jawaban_benar: string; bobot: number }>(
    'SELECT id, jawaban_benar, bobot FROM soals WHERE id_ujian = $1',
    [idUjian]
  );

  // Ambil jawaban siswa
  const jawabans = await query<{ id_soal: string; jawaban_siswa: string | null }>(
    'SELECT id_soal, jawaban_siswa FROM jawabans WHERE id_session = $1',
    [sessionId]
  );

  const jawabanMap = new Map(jawabans.map(j => [j.id_soal, j.jawaban_siswa]));

  let jumlah_benar  = 0;
  let jumlah_salah  = 0;
  let jumlah_kosong = 0;

  // Update benar_salah per jawaban secara paralel
  const updates: Promise<number>[] = [];

  for (const soal of soals) {
    const jawaban = jawabanMap.get(soal.id);
    if (!jawaban) {
      jumlah_kosong++;
    } else if (jawaban === soal.jawaban_benar) {
      jumlah_benar++;
    } else {
      jumlah_salah++;
    }

    updates.push(
      execute(
        `UPDATE jawabans SET benar_salah = $1 WHERE id_session = $2 AND id_soal = $3`,
        [jawaban ? jawaban === soal.jawaban_benar : null, sessionId, soal.id]
      )
    );
  }

  await Promise.all(updates);

  const totalSoal = soals.length;
  const nilai = totalSoal > 0 ? Math.round((jumlah_benar / totalSoal) * 100) : 0;

  // INSERT atomik — ON CONFLICT DO NOTHING mencegah duplikat race condition
  // antara auto-submit dan force-submit yang bisa terjadi bersamaan
  const hasilNilai = await queryOne<Record<string, unknown>>(
    `INSERT INTO nilai
       (id_session, id_siswa, id_jadwal, jumlah_benar, jumlah_salah, jumlah_kosong, nilai, lulus, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
     ON CONFLICT (id_session) DO NOTHING
     RETURNING *`,
    [sessionId, siswaId, jadwalId, jumlah_benar, jumlah_salah, jumlah_kosong, nilai]
  );

  // Jika DO NOTHING terpicu (duplikat), ambil existing row
  if (!hasilNilai) {
    const existing = await queryOne<Record<string, unknown>>(
      'SELECT * FROM nilai WHERE id_session = $1',
      [sessionId]
    );
    return existing ?? {};
  }

  // Update status session ke selesai
  await execute(
    `UPDATE session_ujians SET status = 'selesai' WHERE id = $1`,
    [sessionId]
  );

  return hasilNilai;
}

// DELETE /api/nilai — reset ujian siswa (hapus nilai + session + jawaban)
export async function DELETE(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (auth.role !== 'proktor' && auth.role !== 'admin')
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { siswaId, jadwalId } = await req.json();
    if (!siswaId || !jadwalId)
      return NextResponse.json({ error: 'siswaId dan jadwalId wajib diisi.' }, { status: 400 });

    // Hapus nilai dulu (jawabans & session ikut cascade)
    await execute(
      `DELETE FROM nilai WHERE id_siswa = $1 AND id_jadwal = $2`,
      [siswaId, jadwalId]
    );
    await execute(
      `DELETE FROM session_ujians WHERE id_siswa = $1 AND id_jadwal = $2`,
      [siswaId, jadwalId]
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mereset ujian.' }, { status: 500 });
  }
}

// POST /api/nilai — hitung dan simpan nilai
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const { sessionId } = await req.json();
    if (!sessionId)
      return NextResponse.json({ error: 'sessionId wajib diisi.' }, { status: 400 });

    // Siswa hanya boleh submit session miliknya sendiri
    if (auth.role === 'siswa') {
      const siswa = await queryOne<{ id: string }>(
        'SELECT id FROM siswas WHERE id_user = $1 LIMIT 1',
        [auth.id]
      );
      if (!siswa) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

      const sess = await queryOne<{ id_siswa: string }>(
        'SELECT id_siswa FROM session_ujians WHERE id = $1 LIMIT 1',
        [sessionId]
      );
      if (!sess) return NextResponse.json({ error: 'Session tidak ditemukan.' }, { status: 404 });
      if (sess.id_siswa !== siswa.id)
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const hasilNilai = await hitungDanSimpanNilai(sessionId);
    return NextResponse.json(hasilNilai, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal submit ujian.' }, { status: 500 });
  }
}
