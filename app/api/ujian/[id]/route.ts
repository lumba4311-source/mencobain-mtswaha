import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/ujian/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const { id } = await params;

    const ujian = await queryOne(
      `SELECT
         u.*,
         COALESCE(
           json_agg(DISTINCT uk.kelas_id) FILTER (WHERE uk.kelas_id IS NOT NULL),
           '[]'
         ) AS kelas_ids
       FROM ujians u
       LEFT JOIN ujian_kelas uk ON uk.ujian_id = u.id
       WHERE u.id = $1
       GROUP BY u.id`,
      [id]
    );

    if (!ujian) return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
    return NextResponse.json(ujian);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil ujian.' }, { status: 500 });
  }
}

// PUT /api/ujian/[id]
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['guru', 'proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { id } = await params;
    const body = await req.json();
    const { kelas_ids, ...ujianData } = body;

    // Whitelist kolom yang boleh diupdate — cegah SQL injection & privilege escalation
    const ALLOWED_KEYS = ['nama_ujian', 'jenis_ujian', 'durasi', 'nilai_kkm', 'acak_soal', 'acak_opsi', 'tampil_hasil'];
    const keys = Object.keys(ujianData).filter(k => ALLOWED_KEYS.includes(k));
    if (keys.length > 0) {
      const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
      const vals = keys.map(k => ujianData[k]);
      vals.push(id);
      await execute(`UPDATE ujians SET ${setClauses} WHERE id = $${keys.length + 1}`, vals);
    }

    if (kelas_ids !== undefined) {
      await execute('DELETE FROM ujian_kelas WHERE ujian_id = $1', [id]);
      for (const kelas_id of kelas_ids) {
        await execute(
          'INSERT INTO ujian_kelas (ujian_id, kelas_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [id, kelas_id]
        );
      }
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal update ujian.' }, { status: 500 });
  }
}

// DELETE /api/ujian/[id]
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['guru', 'proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { id } = await params;

    // Cek jadwal aktif
    const jadwal = await query(
      `SELECT id FROM jadwal_ujians WHERE id_ujian = $1 AND status_publikasi = 'Published' LIMIT 1`,
      [id]
    );

    if (jadwal.length > 0) {
      return NextResponse.json(
        { error: 'Tidak bisa hapus ujian yang masih memiliki jadwal aktif.' },
        { status: 409 }
      );
    }

    await execute('DELETE FROM ujians WHERE id = $1', [id]);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal menghapus ujian.' }, { status: 500 });
  }
}
