import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve } from 'path';

// Cross-platform: simpan di <project-root>/uploads/
// Di production (Docker/Linux) ini akan jadi /app/uploads via volume mount
const UPLOAD_DIR = resolve(process.cwd(), 'uploads');

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folder = (formData.get('folder') as string) ?? 'misc';

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File harus berupa gambar.' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran gambar maksimal 10MB.' }, { status: 400 });
    }

    // Buat direktori jika belum ada
    const targetDir = join(UPLOAD_DIR, folder);
    await mkdir(targetDir, { recursive: true });

    // Nama file unik: timestamp + ext
    const ext = file.name.split('.').pop()?.toLowerCase() ?? 'jpg';
    const fileName = `${Date.now()}.${ext}`;
    const filePath = join(targetDir, fileName);

    // Tulis file ke disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filePath, buffer);

    // URL via API route /api/uploads/folder/filename
    const publicUrl = `/api/uploads/${folder}/${fileName}`;

    return NextResponse.json({ url: publicUrl }, { status: 201 });
  } catch (err) {
    console.error('[UPLOAD_ERROR]', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Gagal upload file.' }, { status: 500 });
  }
}
