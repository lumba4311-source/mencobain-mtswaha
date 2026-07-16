import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/jadwal?siswaId=xxx  — jadwal untuk siswa
// GET /api/jadwal              — semua jadwal (proktor)
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const { searchParams } = new URL(req.url);
    const siswaId = searchParams.get('siswaId');

    if (siswaId) {
      const jadwals = await query(
        `SELECT
           j.*,
           COALESCE(
             json_agg(DISTINCT js.siswa_id) FILTER (WHERE js.siswa_id IS NOT NULL),
             '[]'
           ) AS siswa_ids
         FROM jadwal_ujians j
         INNER JOIN jadwal_siswa js2 ON js2.jadwal_id = j.id AND js2.siswa_id = $1
         LEFT JOIN jadwal_siswa js ON js.jadwal_id = j.id
         WHERE j.status_publikasi = 'Published'
         GROUP BY j.id`,
        [siswaId]
      );
      return NextResponse.json(jadwals);
    }

    // Semua jadwal
    const jadwals = await query(
      `SELECT
         j.*,
         COALESCE(
           json_agg(DISTINCT js.siswa_id) FILTER (WHERE js.siswa_id IS NOT NULL),
           '[]'
         ) AS siswa_ids
       FROM jadwal_ujians j
       LEFT JOIN jadwal_siswa js ON js.jadwal_id = j.id
       GROUP BY j.id
       ORDER BY j.created_at DESC`
    );

    return NextResponse.json(jadwals);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil jadwal.' }, { status: 500 });
  }
}

// POST /api/jadwal
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { id_ujian, max_capacity, durasi_menit, status_publikasi, siswa_ids } = await req.json();

    const jadwal = await queryOne<{ id: string }>(
      `INSERT INTO jadwal_ujians (id_ujian, max_capacity, durasi_menit, status_publikasi)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id_ujian, max_capacity ?? 40, durasi_menit, status_publikasi ?? 'Draft']
    );

    if (!jadwal) throw new Error('Gagal insert jadwal.');

    const jadwalId = (jadwal as Record<string, string>).id;

    if (siswa_ids?.length) {
      for (const siswa_id of siswa_ids) {
        await execute(
          'INSERT INTO jadwal_siswa (jadwal_id, siswa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [jadwalId, siswa_id]
        );
      }
    }

    return NextResponse.json({ ...jadwal, siswa_ids: siswa_ids ?? [] }, { status: 201 });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal membuat jadwal.' }, { status: 500 });
  }
}
