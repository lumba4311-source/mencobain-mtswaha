import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join, extname } from 'path';

const UPLOAD_DIR = '/app/uploads';

const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
};

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path } = await context.params;
    const filePath = join(UPLOAD_DIR, ...path);

    // Cegah path traversal
    if (!filePath.startsWith(UPLOAD_DIR)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });
    }

    const buffer = await readFile(filePath);
    const ext = extname(filePath).toLowerCase();
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch {
    return NextResponse.json({ error: 'File tidak ditemukan.' }, { status: 404 });
  }
}
