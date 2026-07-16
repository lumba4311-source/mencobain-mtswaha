import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne, execute } from '@/lib/db';
import { getAuthUser } from '@/lib/apiAuth';

// GET /api/soal/[ujianId]
export async function GET(req: NextRequest, { params }: { params: Promise<{ ujianId: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  try {
    const { ujianId } = await params;

    // Guru/proktor/admin mendapat seluruh data termasuk jawaban_benar
    // Siswa TIDAK mendapat jawaban_benar — field di-strip sebelum dikirim
    const soals = await query(
      'SELECT * FROM soals WHERE id_ujian = $1 ORDER BY nomor ASC',
      [ujianId]
    );

    if (auth.role === 'siswa') {
      // Strip jawaban_benar agar tidak bisa dicuri dari network tab
      const stripped = soals.map(({ jawaban_benar: _jb, ...rest }: Record<string, unknown>) => rest);
      return NextResponse.json(stripped);
    }

    return NextResponse.json(soals);
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal mengambil soal.' }, { status: 500 });
  }
}

// POST /api/soal/[ujianId] — replace semua soal (bulk)
export async function POST(req: NextRequest, { params }: { params: Promise<{ ujianId: string }> }) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['guru', 'proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const { ujianId } = await params;
    const { soals } = await req.json();

    // [API-08] Guru hanya boleh edit soal ujian miliknya sendiri
    if (auth.role === 'guru') {
      const guru = await queryOne<{ id: string }>(
        'SELECT id FROM gurus WHERE id_user = $1 LIMIT 1',
        [auth.id]
      );
      if (!guru) return NextResponse.json({ error: 'Profil guru tidak ditemukan.' }, { status: 404 });

      const ujian = await queryOne<{ id_guru: string }>(
        'SELECT id_guru FROM ujians WHERE id = $1 LIMIT 1',
        [ujianId]
      );
      if (!ujian) return NextResponse.json({ error: 'Ujian tidak ditemukan.' }, { status: 404 });
      if (ujian.id_guru !== guru.id)
        return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    // Hapus soal lama, insert baru
    await execute('DELETE FROM soals WHERE id_ujian = $1', [ujianId]);

    for (const s of soals) {
      await execute(
        `INSERT INTO soals
           (id_ujian, nomor, pertanyaan, opsi_a, opsi_b, opsi_c, opsi_d,
            opsi_a_img, opsi_b_img, opsi_c_img, opsi_d_img,
            jawaban_benar, bobot, gambar_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
        [
          ujianId, s.nomor, s.pertanyaan,
          s.opsi_a, s.opsi_b, s.opsi_c, s.opsi_d,
          s.opsi_a_img ?? null, s.opsi_b_img ?? null,
          s.opsi_c_img ?? null, s.opsi_d_img ?? null,
          s.jawaban_benar, s.bobot, s.gambar_url ?? null,
        ]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ error: 'Gagal menyimpan soal.' }, { status: 500 });
  }
}
