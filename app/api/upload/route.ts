import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join, resolve, basename } from 'path';
import { getAuthUser } from '@/lib/apiAuth';

// Cross-platform: simpan di <project-root>/uploads/
// Di production (Docker/Linux) ini akan jadi /app/uploads via volume mount
const UPLOAD_DIR = resolve(process.cwd(), 'uploads');

// [API-12] Whitelist extension yang diizinkan — tolak SVG (XSS risk) dan format non-gambar
const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const ALLOWED_FOLDERS    = new Set(['soal', 'misc']);

export async function POST(req: NextRequest) {
  const auth = await getAuthUser(req);
  if (!auth) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  if (!['guru', 'proktor', 'admin'].includes(auth.role))
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const folderRaw = (formData.get('folder') as string) ?? 'misc';

    if (!file) {
      return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File harus berupa gambar.' }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Ukuran gambar maksimal 10MB.' }, { status: 400 });
    }

    // [API-11] Sanitasi folder — hanya izinkan nama folder yang sudah diwhitelist
    // mencegah path traversal seperti folder = "../../etc"
    const folder = ALLOWED_FOLDERS.has(folderRaw) ? folderRaw : 'misc';

    // [API-12] Whitelist extension — hanya izinkan format gambar yang aman
    const ext = basename(file.name).split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        { error: 'Format file tidak didukung. Gunakan JPG, PNG, GIF, atau WebP.' },
        { status: 400 }
      );
    }

    // Buat direktori jika belum ada
    const targetDir = join(UPLOAD_DIR, folder);
    await mkdir(targetDir, { recursive: true });

    // Nama file unik: timestamp + random suffix + ext
    // Hindari collision jika banyak upload bersamaan
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const filePath = join(targetDir, fileName);

    // Double-check path tidak keluar dari UPLOAD_DIR (defense in depth)
    if (!resolve(filePath).startsWith(UPLOAD_DIR)) {
      return NextResponse.json({ error: 'Path tidak valid.' }, { status: 400 });
    }

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
