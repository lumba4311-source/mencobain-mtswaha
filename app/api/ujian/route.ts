import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/ujian?guruId=xxx
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const guruId = searchParams.get('guruId');

    const params: unknown[] = [];
    let whereClause = '';
    if (guruId) {
      whereClause = 'WHERE u.id_guru = $1';
      params.push(guruId);
    }

    const ujians = await query(
      `SELECT
         u.*,
         g.nama AS guru_nama,
         COALESCE(
           json_agg(DISTINCT uk.kelas_id) FILTER (WHERE uk.kelas_id IS NOT NULL),
           '[]'
         ) AS kelas_ids,
         COUNT(DISTINCT s.id)::int AS soal_count
       FROM ujians u
       LEFT JOIN gurus g ON g.id = u.id_guru
       LEFT JOIN ujian_kelas uk ON uk.ujian_id = u.id
       LEFT JOIN soals s ON s.id_ujian = u.id
       ${whereClause}
       GROUP BY u.id, g.nama
       ORDER BY u.created_at DESC`,
      params
    );

    return NextResponse.json(ujians);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil data ujian.' }, { status: 500 });
  }
}

// POST /api/ujian
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['guru', 'proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { nama_ujian, jenis_ujian, durasi, nilai_kkm, acak_soal, acak_opsi, tampil_hasil, kelas_ids } = await req.json();

    // [API-09] id_guru diambil dari token, bukan dari body request
    // Mencegah guru membuat ujian atas nama guru lain
    let id_guru: string | null = null;
    if (auth.role === 'guru') {
      const guru = await queryOne<{ id: string }>(
        'SELECT id FROM gurus WHERE id_user = $1 LIMIT 1',
        [auth.id]
      );
      if (!guru) return NextResponse.json({ error: 'Profil guru tidak ditemukan.' }, { status: 404 });
      id_guru = guru.id;
    }
    // proktor/admin boleh membuat ujian tanpa id_guru (atau pass via body jika perlu)

    const ujian = await queryOne<{ id: string }>(
      `INSERT INTO ujians (nama_ujian, id_guru, jenis_ujian, durasi, nilai_kkm, acak_soal, acak_opsi, tampil_hasil)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [nama_ujian, id_guru, jenis_ujian, durasi ?? 90, nilai_kkm ?? 75, acak_soal ?? true, acak_opsi ?? true, tampil_hasil ?? false]
    );

    if (!ujian) throw new Error('Gagal insert ujian.');

    if (kelas_ids?.length) {
      for (const kelas_id of kelas_ids) {
        await execute(
          'INSERT INTO ujian_kelas (ujian_id, kelas_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [(ujian as Record<string, string>).id, kelas_id]
        );
      }
    }

    return NextResponse.json({ ...ujian, kelas_ids: kelas_ids ?? [] }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal membuat ujian.' }, { status: 500 });
  }
}
