import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getAuthUser } from '@/lib/apiAuth';
import { hitungDanSimpanNilai } from '../nilai/route';

// GET /api/monitoring?jadwalId=xxx
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const jadwalId = new URL(req.url).searchParams.get('jadwalId');

    if (!jadwalId)
      return NextResponse.json({ error: 'jadwalId wajib diisi.' }, { status: 400 });

    // Ambil jadwal + ujian
    const jadwal = await queryOne<{
      id: string; id_ujian: string;
      ujians: { durasi: number };
    }>(
      `SELECT j.*, row_to_json(u.*) AS ujians
       FROM jadwal_ujians j
       JOIN ujians u ON u.id = j.id_ujian
       WHERE j.id = $1`,
      [jadwalId]
    );

    if (!jadwal) return NextResponse.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 });

    // Ambil daftar siswa di jadwal
    const jadwalSiswa = await query<{ siswa_id: string }>(
      'SELECT siswa_id FROM jadwal_siswa WHERE jadwal_id = $1',
      [jadwalId]
    );

    const siswaIds = jadwalSiswa.map(r => r.siswa_id);
    if (!siswaIds.length) return NextResponse.json([]);

    // Ambil data siswa
    const placeholders = siswaIds.map((_, i) => `$${i + 1}`).join(', ');
    const siswas = await query(
      `SELECT id, nama, nis, id_kelas FROM siswas WHERE id IN (${placeholders})`,
      siswaIds
    );

    // Ambil sessions dalam jadwal
    const sessions = await query(
      `SELECT id, id_siswa, id_jadwal, status, sisa_waktu, deadline, started_at
       FROM session_ujians WHERE id_jadwal = $1`,
      [jadwalId]
    );

    // Hitung jumlah jawaban per session
    const sessionIds = sessions.map(s => (s as { id: string }).id);
    const jawabanCounts: Record<string, number> = {};

    if (sessionIds.length) {
      const sessPlaceholders = sessionIds.map((_, i) => `$${i + 1}`).join(', ');
      const jawabans = await query<{ id_session: string }>(
        `SELECT id_session FROM jawabans
         WHERE id_session IN (${sessPlaceholders})
         AND jawaban_siswa IS NOT NULL`,
        sessionIds
      );
      for (const j of jawabans) {
        const sid = j.id_session;
        jawabanCounts[sid] = (jawabanCounts[sid] ?? 0) + 1;
      }
    }

    // Ambil total soal untuk jadwal ini
    const soalCount = await queryOne<{ count: string }>(
      'SELECT COUNT(*)::text AS count FROM soals WHERE id_ujian = $1',
      [jadwal.id_ujian]
    );
    const totalSoal = parseInt(soalCount?.count ?? '0', 10);

    // Bangun response rows
    const sessionMap: Record<string, Record<string, unknown>> = {};
    for (const s of sessions) {
      const sess = s as Record<string, unknown>;
      sessionMap[sess.id_siswa as string] = sess;
    }

    const rows = siswas.map(sw => {
      const siswa = sw as Record<string, unknown>;
      const sess  = sessionMap[siswa.id as string];
      const jumlahDijawab = sess ? (jawabanCounts[sess.id as string] ?? 0) : 0;

      return {
        siswa,
        sessionId:        sess?.id ?? null,
        status:           sess?.status ?? 'Belum Ujian',
        sisa_waktu:       sess?.sisa_waktu ?? null,
        started_at:       sess?.started_at ?? null,
        deadline:         sess?.deadline ?? null,
        jumlahDijawab,
        totalSoal,
        progress: totalSoal > 0 ? Math.round((jumlahDijawab / totalSoal) * 100) : 0,
      };
    });

    return NextResponse.json(rows);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil data monitoring.' }, { status: 500 });
  }
}

// POST /api/monitoring — force submit session siswa
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { sessionId } = await req.json();

    if (!sessionId)
      return NextResponse.json({ error: 'sessionId wajib diisi.' }, { status: 400 });

    // [FORCE-02] Verifikasi bahwa sessionId benar-benar ada dan ambil jadwalId-nya
    const session = await queryOne<{ id: string; id_jadwal: string; status: string }>(
      'SELECT id, id_jadwal, status FROM session_ujians WHERE id = $1 LIMIT 1',
      [sessionId]
    );

    if (!session)
      return NextResponse.json({ error: 'Session tidak ditemukan.' }, { status: 404 });

    // Jika sudah selesai, tidak perlu force submit lagi
    if (session.status === 'selesai' || session.status === 'force_submit')
      return NextResponse.json({ error: 'Session sudah selesai.' }, { status: 409 });

    // Set status force_submit sebelum hitung nilai
    await execute(
      `UPDATE session_ujians SET status = 'force_submit' WHERE id = $1`,
      [sessionId]
    );

    // [FORCE-01] Panggil fungsi langsung — tidak perlu fakeReq dengan auth palsu
    const nilai = await hitungDanSimpanNilai(sessionId);

    return NextResponse.json({ ok: true, nilai });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal force submit.' }, { status: 500 });
  }
}
