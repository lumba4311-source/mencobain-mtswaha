import { NextRequest, NextResponse } from 'next/server';
import { query, execute } from '@/lib/db';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/jawaban?sessionId=xxx
export async function GET(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const sessionId = new URL(req.url).searchParams.get('sessionId');

    if (!sessionId)
      return NextResponse.json({ error: 'sessionId wajib diisi.' }, { status: 400 });

    const jawabans = await query(
      'SELECT * FROM jawabans WHERE id_session = $1',
      [sessionId]
    );

    return NextResponse.json(jawabans);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil jawaban.' }, { status: 500 });
  }
}

// POST /api/jawaban — upsert jawaban siswa
export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const { sessionId, soalId, jawaban_siswa, status_soal } = await req.json();

    // UPSERT: insert jika belum ada, update jika sudah ada
    await execute(
      `INSERT INTO jawabans (id_session, id_soal, jawaban_siswa, status_soal, waktu_jawab)
       VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (id_session, id_soal)
       DO UPDATE SET
         jawaban_siswa = EXCLUDED.jawaban_siswa,
         status_soal   = EXCLUDED.status_soal,
         waktu_jawab   = NOW()`,
      [sessionId, soalId, jawaban_siswa ?? null, status_soal ?? 'belum']
    );

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal menyimpan jawaban.' }, { status: 500 });
  }
}
