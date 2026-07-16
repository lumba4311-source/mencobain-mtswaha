import { test, expect, type APIRequestContext } from '@playwright/test';

async function loginAs(r: APIRequestContext, username: string, password: string) {
  const res = await r.post('/api/auth/login', { data: { username, password } });
  expect(res.status()).toBe(200);
  return res;
}

const loginAsGuru    = (r: APIRequestContext) => loginAs(r, '102008', '102008@umbk');
const loginAsProktor = (r: APIRequestContext) => loginAs(r, 'proktor1', 'ecbtmtswaha');
const loginAsSiswa   = (r: APIRequestContext) => loginAs(r, '240006', '240006@umbk');

// Buat 1x1 PNG minimal valid (binary)
function minimalPng(): Buffer {
  return Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4' +
    '890000000a49444154789c6260000000020001e221bc330000000049454e44ae426082',
    'hex'
  );
}

let uploadedUrl = '';

// ── 1. POST /api/upload ───────────────────────────────────────────────────────
test.describe('POST /api/upload', () => {
  test('Guru bisa upload gambar PNG → 201 + url', async ({ request }) => {
    await loginAsGuru(request);
    const png = minimalPng();
    const res = await request.post('/api/upload', {
      multipart: {
        file  : { name: 'test.png', mimeType: 'image/png', buffer: png },
        folder: 'soal',
      },
    });
    expect(res.status()).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty('url');
    expect(body.url).toMatch(/^\/api\/uploads\/soal\/.+\.png$/);
    uploadedUrl = body.url;
  });

  test('Proktor bisa upload gambar → 201', async ({ request }) => {
    await loginAsProktor(request);
    const png = minimalPng();
    const res = await request.post('/api/upload', {
      multipart: {
        file  : { name: 'test2.png', mimeType: 'image/png', buffer: png },
        folder: 'misc',
      },
    });
    expect(res.status()).toBe(201);
    expect((await res.json()).url).toMatch(/^\/api\/uploads\/misc\/.+\.png$/);
  });

  test('Siswa tidak bisa upload → 403', async ({ request }) => {
    await loginAsSiswa(request);
    const png = minimalPng();
    const res = await request.post('/api/upload', {
      multipart: {
        file  : { name: 'test.png', mimeType: 'image/png', buffer: png },
        folder: 'misc',
      },
    });
    expect(res.status()).toBe(403);
  });

  test('Tanpa auth → 401', async ({ playwright }) => {
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.post('/api/upload', {
      multipart: {
        file  : { name: 'test.png', mimeType: 'image/png', buffer: minimalPng() },
        folder: 'misc',
      },
    });
    expect(res.status()).toBe(401);
    await ctx.dispose();
  });

  test('Tanpa file → 400', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.post('/api/upload', {
      multipart: { folder: 'misc' },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('File tidak ditemukan');
  });

  test('File bukan gambar (tipe text) → 400', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.post('/api/upload', {
      multipart: {
        file  : { name: 'test.txt', mimeType: 'text/plain', buffer: Buffer.from('hello') },
        folder: 'misc',
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('gambar');
  });

  test('Extension tidak didukung (.svg) → 400', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.post('/api/upload', {
      multipart: {
        file  : { name: 'test.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') },
        folder: 'misc',
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('Format file tidak didukung');
  });

  test('Folder tidak dikenal di-fallback ke misc', async ({ request }) => {
    await loginAsGuru(request);
    const png = minimalPng();
    const res = await request.post('/api/upload', {
      multipart: {
        file  : { name: 'test.png', mimeType: 'image/png', buffer: png },
        folder: 'unknown_folder',
      },
    });
    expect(res.status()).toBe(201);
    expect((await res.json()).url).toContain('/misc/');
  });
});

// ── 2. GET /api/uploads/[...path] ─────────────────────────────────────────────
test.describe('GET /api/uploads/[...path]', () => {
  test('GET file yang baru diupload → 200 + Content-Type image/png', async ({ request }) => {
    if (!uploadedUrl) {
      test.skip();
      return;
    }
    await loginAsGuru(request);
    const res = await request.get(uploadedUrl);
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('image/png');
  });

  test('GET file yang tidak ada → 404', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.get('/api/uploads/misc/nonexistent-file-xyz.png');
    expect(res.status()).toBe(404);
  });

  test('Path traversal attack dicegah → 403 atau 404', async ({ request }) => {
    await loginAsGuru(request);
    const res = await request.get('/api/uploads/../../../etc/passwd');
    expect([403, 404]).toContain(res.status());
  });

  test('GET uploads tidak butuh auth (public cache)', async ({ playwright }) => {
    if (!uploadedUrl) return;
    const ctx = await playwright.request.newContext({ baseURL: 'http://localhost:3000' });
    const res = await ctx.get(uploadedUrl);
    // File publik setelah upload — tidak ada auth check di route GET uploads
    expect([200, 404]).toContain(res.status());
    await ctx.dispose();
  });
});
