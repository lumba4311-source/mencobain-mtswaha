import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/jadwal/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const { id } = await params;

    const jadwal = await queryOne(
      `SELECT
         j.*,
         row_to_json(u.*) AS ujians,
         COALESCE(
           json_agg(DISTINCT js.siswa_id) FILTER (WHERE js.siswa_id IS NOT NULL),
           '[]'
         ) AS siswa_ids
       FROM jadwal_ujians j
       LEFT JOIN ujians u ON u.id = j.id_ujian
       LEFT JOIN jadwal_siswa js ON js.jadwal_id = j.id
       WHERE j.id = $1
       GROUP BY j.id, u.id`,
      [id]
    );

    if (!jadwal) return NextResponse.json({ error: 'Jadwal tidak ditemukan.' }, { status: 404 });
    return NextResponse.json(jadwal);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil jadwal.' }, { status: 500 });
  }
}

// PUT /api/jadwal/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { id } = await params;
    const { siswa_ids, ...jadwalData } = await req.json();

    // Whitelist kolom yang boleh diupdate — cegah SQL injection & privilege escalation
    const ALLOWED_KEYS = ['id_ujian', 'max_capacity', 'durasi_menit', 'status_publikasi'];
    const keys = Object.keys(jadwalData).filter(k => ALLOWED_KEYS.includes(k));
    if (keys.length > 0) {
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const vals = [...keys.map(k => jadwalData[k]), id];
      await execute(`UPDATE jadwal_ujians SET ${setClauses} WHERE id = $${keys.length + 1}`, vals);
    }

    if (siswa_ids !== undefined) {
      await execute('DELETE FROM jadwal_siswa WHERE jadwal_id = $1', [id]);
      for (const siswa_id of siswa_ids) {
        await execute(
          'INSERT INTO jadwal_siswa (jadwal_id, siswa_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, siswa_id]
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal update jadwal.' }, { status: 500 });
  }
}

// DELETE /api/jadwal/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { id } = await params;

    const sessions = await query('SELECT id FROM session_ujians WHERE id_jadwal = $1', [id]);
    const sessionIds = sessions.map((s) => (s as { id: string }).id);

    if (sessionIds.length) {
      const placeholders = sessionIds.map((_, i) => `$${i + 1}`).join(', ');
      await execute(`DELETE FROM jawabans WHERE id_session IN (${placeholders})`, sessionIds);
      await execute(`DELETE FROM nilai WHERE id_session IN (${placeholders})`, sessionIds);
      await execute(`DELETE FROM session_ujians WHERE id IN (${placeholders})`, sessionIds);
    }

    await execute('DELETE FROM jadwal_siswa WHERE jadwal_id = $1', [id]);
    await execute('DELETE FROM jadwal_ujians WHERE id = $1', [id]);

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal menghapus jadwal.' }, { status: 500 });
  }
}
