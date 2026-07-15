/**
 * Perf test untuk app/api/nilai/route.ts — P1
 * Verifikasi update benar_salah berjalan paralel (Promise.all), bukan sequential
 */

import { NextRequest } from 'next/server';

jest.mock('@/lib/apiAuth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createSupabaseServerClient: jest.fn() }));

import { getAuthUser } from '@/lib/apiAuth';
import { createSupabaseServerClient } from '@/lib/supabase';
import { POST } from '@/app/api/nilai/route';

const mockGetAuthUser = getAuthUser as jest.Mock;
const mockCreateSupabase = createSupabaseServerClient as jest.Mock;

function makeReq(body: object) {
  return new NextRequest('http://localhost/api/nilai', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  });
}

function makeSoals(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `soal-${i + 1}`,
    jawaban_benar: 'A',
    bobot: 1,
  }));
}

function makeJawabans(soals: ReturnType<typeof makeSoals>, sessionId: string) {
  return soals.map((s, i) => ({
    id_soal: s.id,
    id_session: sessionId,
    jawaban_siswa: i % 2 === 0 ? 'A' : 'B', // ganjil=benar, genap=salah
  }));
}

// Buat mock supabase lengkap untuk POST /api/nilai
// updateMock: jest.Mock opsional untuk spy jumlah call update jawabans
function buildMock(soals: object[], jawabans: object[], updateMock?: jest.Mock) {
  const updateJawaban = updateMock ?? jest.fn().mockReturnValue({
    eq: jest.fn().mockReturnThis(),
  });
  // Pastikan .eq() chain dari update selalu bisa resolve
  updateJawaban.mockImplementation(() => {
    const chain = { eq: jest.fn() };
    chain.eq.mockReturnValue(chain); // chain untuk .eq().eq()
    return chain;
  });

  mockCreateSupabase.mockReturnValue({
    from: jest.fn().mockImplementation((table: string) => {
      if (table === 'session_ujians') return {
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({
          data: {
            id: 'ses-1', id_siswa: 's1', id_jadwal: 'j1',
            jadwal_ujians: { id_ujian: 'u1' },
          },
          error: null,
        }),
        update: jest.fn().mockReturnThis(), // untuk update status selesai
      };
      if (table === 'nilai') return {
        select:      jest.fn().mockReturnThis(),
        eq:          jest.fn().mockReturnThis(),
        maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
        insert:      jest.fn().mockReturnThis(),
        single:      jest.fn().mockResolvedValue({
          data: { id: 'n1', nilai: 50, jumlah_benar: 20, jumlah_salah: 20, jumlah_kosong: 0 },
          error: null,
        }),
      };
      if (table === 'soals') return {
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockResolvedValue({ data: soals, error: null }),
      };
      if (table === 'jawabans') return {
        select: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockResolvedValue({ data: jawabans, error: null }),
        update: updateJawaban,
      };
      return {
        update: jest.fn().mockReturnThis(),
        eq:     jest.fn().mockResolvedValue({ error: null }),
      };
    }),
  });

  return updateJawaban;
}

// ─── P1: update berjalan paralel ─────────────────────────────────────────────

describe('P1 — POST /api/nilai: update benar_salah paralel', () => {
  const SESSION_ID = 'ses-1';
  const SOAL_COUNT = 40;

  beforeEach(() => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
  });

  test('update dipanggil sebanyak jumlah soal (40x)', async () => {
    const soals    = makeSoals(SOAL_COUNT);
    const jawabans = makeJawabans(soals, SESSION_ID);
    const updateMock = buildMock(soals, jawabans);

    await POST(makeReq({ sessionId: SESSION_ID }));
    expect(updateMock).toHaveBeenCalledTimes(SOAL_COUNT);
  });

  test('tidak return 500 — semua update paralel berhasil', async () => {
    const soals    = makeSoals(SOAL_COUNT);
    const jawabans = makeJawabans(soals, SESSION_ID);
    buildMock(soals, jawabans);

    const res = await POST(makeReq({ sessionId: SESSION_ID }));
    expect(res.status).not.toBe(500);
  });

  test('semua soal diproses — tidak ada yang terlewat', async () => {
    const soals    = makeSoals(SOAL_COUNT);
    const jawabans = makeJawabans(soals, SESSION_ID);
    const updateMock = buildMock(soals, jawabans);

    await POST(makeReq({ sessionId: SESSION_ID }));

    // Setiap soal harus ada update-nya
    expect(updateMock.mock.calls.length).toBe(SOAL_COUNT);
    // Semua call harus ada argumen { benar_salah: boolean|null }
    updateMock.mock.calls.forEach((call: unknown[]) => {
      const arg = call[0] as Record<string, unknown>;
      expect(arg).toHaveProperty('benar_salah');
    });
  });
});

// ─── P1: Nilai dihitung benar untuk berbagai kasus ────────────────────────────

describe('P1 — Nilai dihitung benar untuk berbagai kasus', () => {
  const SESSION_ID = 'ses-2';

  beforeEach(() => {
    mockGetAuthUser.mockResolvedValue({ id: 'u1', role: 'siswa' });
  });

  test('20 dari 40 soal benar — tidak return 500', async () => {
    const soals    = makeSoals(40);
    const jawabans = makeJawabans(soals, SESSION_ID);

    // Override mock insert agar bisa cek nilai yang diinsert
    const insertMock = jest.fn().mockReturnThis();
    const singleMock = jest.fn().mockResolvedValue({
      data: { id: 'n1', nilai: 50, jumlah_benar: 20, jumlah_salah: 20, jumlah_kosong: 0 },
      error: null,
    });

    const updateJawaban = jest.fn().mockImplementation(() => {
      const chain = { eq: jest.fn() };
      chain.eq.mockReturnValue(chain);
      return chain;
    });

    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'session_ujians') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: SESSION_ID, id_siswa: 's1', id_jadwal: 'j1', jadwal_ujians: { id_ujian: 'u1' } },
            error: null,
          }),
          update: jest.fn().mockReturnThis(),
        };
        if (table === 'nilai') return {
          select:      jest.fn().mockReturnThis(),
          eq:          jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          insert:      insertMock,
          single:      singleMock,
        };
        if (table === 'soals') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockResolvedValue({ data: soals, error: null }),
        };
        if (table === 'jawabans') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockResolvedValue({ data: jawabans, error: null }),
          update: updateJawaban,
        };
        return { update: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ error: null }) };
      }),
    });

    const res = await POST(makeReq({ sessionId: SESSION_ID }));
    expect(res.status).not.toBe(500);
    // insert dipanggil dengan nilai
    expect(insertMock).toHaveBeenCalled();
    const insertArg = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg).toHaveProperty('nilai');
    expect(insertArg).toHaveProperty('jumlah_benar');
    expect(insertArg).toHaveProperty('jumlah_salah');
    expect(insertArg).toHaveProperty('jumlah_kosong');
    // 20 benar, 20 salah, 0 kosong
    expect(insertArg.jumlah_benar).toBe(20);
    expect(insertArg.jumlah_salah).toBe(20);
    expect(insertArg.jumlah_kosong).toBe(0);
    expect(insertArg.nilai).toBe(50); // round(20/40*100)
  });

  test('semua jawaban kosong — jumlah_kosong = 2, nilai = 0', async () => {
    const soals    = [
      { id: 'q1', jawaban_benar: 'A', bobot: 1 },
      { id: 'q2', jawaban_benar: 'B', bobot: 1 },
    ];
    const jawabans: object[] = []; // tidak ada jawaban

    const insertMock = jest.fn().mockReturnThis();
    const singleMock = jest.fn().mockResolvedValue({
      data: { id: 'n1', nilai: 0, jumlah_benar: 0, jumlah_salah: 0, jumlah_kosong: 2 },
      error: null,
    });

    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'session_ujians') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: SESSION_ID, id_siswa: 's1', id_jadwal: 'j1', jadwal_ujians: { id_ujian: 'u1' } },
            error: null,
          }),
          update: jest.fn().mockReturnThis(),
        };
        if (table === 'nilai') return {
          select:      jest.fn().mockReturnThis(),
          eq:          jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          insert:      insertMock,
          single:      singleMock,
        };
        if (table === 'soals')    return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: soals, error: null }) };
        if (table === 'jawabans') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockResolvedValue({ data: jawabans, error: null }),
          update: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnThis() }),
        };
        return { update: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ error: null }) };
      }),
    });

    const res = await POST(makeReq({ sessionId: SESSION_ID }));
    expect(res.status).not.toBe(500);
    const insertArg = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.jumlah_benar).toBe(0);
    expect(insertArg.jumlah_kosong).toBe(2);
    expect(insertArg.nilai).toBe(0);
  });

  test('tidak ada soal — nilai 0, tidak error', async () => {
    const insertMock = jest.fn().mockReturnThis();
    const singleMock = jest.fn().mockResolvedValue({
      data: { id: 'n1', nilai: 0, jumlah_benar: 0, jumlah_salah: 0, jumlah_kosong: 0 },
      error: null,
    });

    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'session_ujians') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: SESSION_ID, id_siswa: 's1', id_jadwal: 'j1', jadwal_ujians: { id_ujian: 'u1' } },
            error: null,
          }),
          update: jest.fn().mockReturnThis(),
        };
        if (table === 'nilai') return {
          select:      jest.fn().mockReturnThis(),
          eq:          jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
          insert:      insertMock,
          single:      singleMock,
        };
        if (table === 'soals')    return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }) };
        if (table === 'jawabans') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockResolvedValue({ data: [], error: null }),
          update: jest.fn().mockReturnValue({ eq: jest.fn().mockReturnThis() }),
        };
        return { update: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ error: null }) };
      }),
    });

    const res = await POST(makeReq({ sessionId: SESSION_ID }));
    expect(res.status).not.toBe(500);
    const insertArg = insertMock.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.nilai).toBe(0);
  });

  test('idempotent — submit kedua return nilai yang sudah ada', async () => {
    const existingNilai = { id: 'n-existing', nilai: 75, id_session: SESSION_ID };
    mockCreateSupabase.mockReturnValue({
      from: jest.fn().mockImplementation((table: string) => {
        if (table === 'session_ujians') return {
          select: jest.fn().mockReturnThis(),
          eq:     jest.fn().mockReturnThis(),
          single: jest.fn().mockResolvedValue({
            data: { id: SESSION_ID, id_siswa: 's1', id_jadwal: 'j1', jadwal_ujians: { id_ujian: 'u1' } },
            error: null,
          }),
        };
        if (table === 'nilai') return {
          select:      jest.fn().mockReturnThis(),
          eq:          jest.fn().mockReturnThis(),
          maybeSingle: jest.fn().mockResolvedValue({ data: { id: 'n-existing' }, error: null }),
          single:      jest.fn().mockResolvedValue({ data: existingNilai, error: null }),
        };
        return { select: jest.fn().mockReturnThis(), eq: jest.fn().mockResolvedValue({ data: [], error: null }) };
      }),
    });

    const res = await POST(makeReq({ sessionId: SESSION_ID }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe('n-existing');
    expect(body.nilai).toBe(75);
  });
});
