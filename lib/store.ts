// ============================================================
// UMBK — MTS WAHA — In-Memory State Store (No Database)
// ============================================================

import type {
  User, Kelas, MataPelajaran, Siswa, Guru,
  Ujian, Soal, JadwalUjian, SessionUjian, Jawaban, Nilai,
  JawabanBenar, StatusSession,
} from '@/types';

// ── Fisher-Yates Shuffle ─────────────────────────────────────
export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Seed Data ────────────────────────────────────────────────

export const kelas: Kelas[] = [
  { id: 'k1', nama_kelas: '9A', tingkat: 9, tahun_ajaran: '2025/2026' },
  { id: 'k2', nama_kelas: '9B', tingkat: 9, tahun_ajaran: '2025/2026' },
  { id: 'k3', nama_kelas: '9C', tingkat: 9, tahun_ajaran: '2025/2026' },
  { id: 'k4', nama_kelas: '9D', tingkat: 9, tahun_ajaran: '2025/2026' },
  { id: 'k5', nama_kelas: '9E', tingkat: 9, tahun_ajaran: '2025/2026' },
  { id: 'k6', nama_kelas: '9F', tingkat: 9, tahun_ajaran: '2025/2026' },
  { id: 'k7', nama_kelas: '9G', tingkat: 9, tahun_ajaran: '2025/2026' },
];

export const mataPelajaran: MataPelajaran[] = [
  { id: 'mp1',  nama_mapel: 'Bahasa Indonesia',          kelompok: 'umum' },
  { id: 'mp2',  nama_mapel: 'Matematika',                kelompok: 'umum' },
  { id: 'mp3',  nama_mapel: 'IPA',                       kelompok: 'umum' },
  { id: 'mp4',  nama_mapel: 'IPS',                       kelompok: 'umum' },
  { id: 'mp5',  nama_mapel: 'Bahasa Inggris',            kelompok: 'umum' },
  { id: 'mp6',  nama_mapel: 'PKN',                       kelompok: 'umum' },
  { id: 'mp7',  nama_mapel: 'Seni Budaya',               kelompok: 'umum' },
  { id: 'mp8',  nama_mapel: 'Bahasa Arab',               kelompok: 'pesantren' },
  { id: 'mp9',  nama_mapel: 'Al-Qur\'an Hadist',         kelompok: 'pesantren' },
  { id: 'mp10', nama_mapel: 'Fikih',                     kelompok: 'pesantren' },
  { id: 'mp11', nama_mapel: 'Sejarah Kebudayaan Islam',  kelompok: 'pesantren' },
  { id: 'mp12', nama_mapel: 'Aswaja',                    kelompok: 'pesantren' },
  { id: 'mp13', nama_mapel: 'Akidah Akhlak',             kelompok: 'pesantren' },
];

export const users: User[] = [
  { id: 'u1',  username: 'proktor',   password: 'proktor123',  role: 'proktor', status: 'aktif',    nama: 'Ust. Ahmad Proktor' },
  { id: 'u2',  username: 'guru1',     password: 'guru123',     role: 'guru',    status: 'aktif',    nama: 'Ust. Budi Santoso' },
  { id: 'u3',  username: 'guru2',     password: 'guru123',     role: 'guru',    status: 'aktif',    nama: 'Ustz. Siti Rahma' },
  { id: 'u4',  username: 'guru3',     password: 'guru123',     role: 'guru',    status: 'aktif',    nama: 'Ust. Hasan Basri' },
  { id: 'u5',  username: '001',       password: 'siswa123',    role: 'siswa',   status: 'aktif',    nama: 'Fatimah Az-Zahra' },
  { id: 'u6',  username: '002',       password: 'siswa123',    role: 'siswa',   status: 'aktif',    nama: 'Aisyah Putri' },
  { id: 'u7',  username: '003',       password: 'siswa123',    role: 'siswa',   status: 'aktif',    nama: 'Khadijah Salsabila' },
  { id: 'u8',  username: '004',       password: 'siswa123',    role: 'siswa',   status: 'aktif',    nama: 'Maryam Nur Hidayah' },
  { id: 'u9',  username: '005',       password: 'siswa123',    role: 'siswa',   status: 'aktif',    nama: 'Zainab Rahmawati' },
  { id: 'u10', username: '006',       password: 'siswa123',    role: 'siswa',   status: 'nonaktif', nama: 'Hafshah Berliana' },
];

export const siswas: Siswa[] = [
  { id: 's1', nis: '20250001', nama: 'Fatimah Az-Zahra',    id_kelas: 'k1', id_user: 'u5' },
  { id: 's2', nis: '20250002', nama: 'Aisyah Putri',        id_kelas: 'k1', id_user: 'u6' },
  { id: 's3', nis: '20250003', nama: 'Khadijah Salsabila',  id_kelas: 'k2', id_user: 'u7' },
  { id: 's4', nis: '20250004', nama: 'Maryam Nur Hidayah',  id_kelas: 'k2', id_user: 'u8' },
  { id: 's5', nis: '20250005', nama: 'Zainab Rahmawati',    id_kelas: 'k3', id_user: 'u9' },
  { id: 's6', nis: '20250006', nama: 'Hafshah Berliana',    id_kelas: 'k3', id_user: 'u10' },
];

export const gurus: Guru[] = [
  { id: 'g1', nip: '198501012010011001', nama: 'Ust. Budi Santoso',  id_user: 'u2', mapel_ids: ['mp1', 'mp2'] },
  { id: 'g2', nip: '198701022011012002', nama: 'Ustz. Siti Rahma',   id_user: 'u3', mapel_ids: ['mp5', 'mp8'] },
  { id: 'g3', nip: '199001032012011003', nama: 'Ust. Hasan Basri',   id_user: 'u4', mapel_ids: ['mp9', 'mp10', 'mp13'] },
];

export const ujians: Ujian[] = [
  {
    id: 'uj1',
    nama_ujian: 'UAS Bahasa Indonesia Semester 1',
    id_mapel: 'mp1',
    id_guru: 'g1',
    jenis_ujian: 'UAS',
    durasi: 90,
    nilai_kkm: 75,
    acak_soal: true,
    acak_opsi: true,
    tampil_hasil: true,
    kelas_ids: ['k1', 'k2'],
    created_at: '2026-07-01T08:00:00Z',
  },
  {
    id: 'uj2',
    nama_ujian: 'PTS Matematika Semester 1',
    id_mapel: 'mp2',
    id_guru: 'g1',
    jenis_ujian: 'PTS',
    durasi: 60,
    nilai_kkm: 70,
    acak_soal: true,
    acak_opsi: false,
    tampil_hasil: false,
    kelas_ids: ['k1', 'k2', 'k3'],
    created_at: '2026-07-02T08:00:00Z',
  },
  {
    id: 'uj3',
    nama_ujian: 'Latihan Bahasa Inggris',
    id_mapel: 'mp5',
    id_guru: 'g2',
    jenis_ujian: 'LATIHAN',
    durasi: 45,
    nilai_kkm: 75,
    acak_soal: false,
    acak_opsi: false,
    tampil_hasil: true,
    kelas_ids: ['k1'],
    created_at: '2026-07-03T08:00:00Z',
  },
];

export const soals: Soal[] = [
  // UAS Bahasa Indonesia (uj1) — 5 soal demo
  {
    id: 'sq1', id_ujian: 'uj1', nomor: 1,
    pertanyaan: 'Sinonim kata "bijaksana" yang paling tepat adalah...',
    opsi_a: 'Pandai', opsi_b: 'Arif', opsi_c: 'Cerdas', opsi_d: 'Pintar', opsi_e: 'Tahu',
    jawaban_benar: 'B', bobot: 1,
  },
  {
    id: 'sq2', id_ujian: 'uj1', nomor: 2,
    pertanyaan: 'Kalimat yang menggunakan majas personifikasi adalah...',
    opsi_a: 'Dia secepat kilat', opsi_b: 'Angin berbisik manja di telingaku', opsi_c: 'Mukanya pucat seperti kertas', opsi_d: 'Dia adalah bintang keluarga', opsi_e: 'Suaranya merdu bagaikan seruling',
    jawaban_benar: 'B', bobot: 1,
  },
  {
    id: 'sq3', id_ujian: 'uj1', nomor: 3,
    pertanyaan: 'Paragraf yang kalimat utamanya terletak di awal disebut paragraf...',
    opsi_a: 'Induktif', opsi_b: 'Campuran', opsi_c: 'Deduktif', opsi_d: 'Naratif', opsi_e: 'Deskriptif',
    jawaban_benar: 'C', bobot: 1,
  },
  {
    id: 'sq4', id_ujian: 'uj1', nomor: 4,
    pertanyaan: 'Tanda baca yang digunakan untuk memisahkan anak kalimat dari induk kalimat adalah...',
    opsi_a: 'Titik (.)' , opsi_b: 'Seru (!)', opsi_c: 'Koma (,)', opsi_d: 'Titik dua (:)', opsi_e: 'Titik koma (;)',
    jawaban_benar: 'C', bobot: 1,
  },
  {
    id: 'sq5', id_ujian: 'uj1', nomor: 5,
    pertanyaan: 'Unsur intrinsik yang menggambarkan watak tokoh disebut...',
    opsi_a: 'Tema', opsi_b: 'Alur', opsi_c: 'Setting', opsi_d: 'Penokohan', opsi_e: 'Amanat',
    jawaban_benar: 'D', bobot: 1,
  },
  // PTS Matematika (uj2) — 5 soal demo
  {
    id: 'sq6', id_ujian: 'uj2', nomor: 1,
    pertanyaan: 'Hasil dari 2³ × 2² adalah...',
    opsi_a: '16', opsi_b: '32', opsi_c: '64', opsi_d: '128', opsi_e: '256',
    jawaban_benar: 'B', bobot: 2,
  },
  {
    id: 'sq7', id_ujian: 'uj2', nomor: 2,
    pertanyaan: 'Nilai x dari persamaan 3x + 6 = 18 adalah...',
    opsi_a: '2', opsi_b: '3', opsi_c: '4', opsi_d: '6', opsi_e: '8',
    jawaban_benar: 'C', bobot: 2,
  },
  {
    id: 'sq8', id_ujian: 'uj2', nomor: 3,
    pertanyaan: 'Luas persegi panjang dengan panjang 12 cm dan lebar 8 cm adalah...',
    opsi_a: '20 cm²', opsi_b: '40 cm²', opsi_c: '80 cm²', opsi_d: '96 cm²', opsi_e: '120 cm²',
    jawaban_benar: 'D', bobot: 2,
  },
  {
    id: 'sq9', id_ujian: 'uj2', nomor: 4,
    pertanyaan: 'Bentuk sederhana dari pecahan 24/36 adalah...',
    opsi_a: '1/2', opsi_b: '2/3', opsi_c: '3/4', opsi_d: '4/6', opsi_e: '6/9',
    jawaban_benar: 'B', bobot: 2,
  },
  {
    id: 'sq10', id_ujian: 'uj2', nomor: 5,
    pertanyaan: 'Volume kubus dengan rusuk 5 cm adalah...',
    opsi_a: '25 cm³', opsi_b: '75 cm³', opsi_c: '100 cm³', opsi_d: '125 cm³', opsi_e: '150 cm³',
    jawaban_benar: 'D', bobot: 2,
  },
  // Latihan Bahasa Inggris (uj3) — 5 soal demo
  {
    id: 'sq11', id_ujian: 'uj3', nomor: 1,
    pertanyaan: 'The synonym of "happy" is...',
    opsi_a: 'Sad', opsi_b: 'Angry', opsi_c: 'Joyful', opsi_d: 'Tired', opsi_e: 'Bored',
    jawaban_benar: 'C', bobot: 1,
  },
  {
    id: 'sq12', id_ujian: 'uj3', nomor: 2,
    pertanyaan: 'Choose the correct sentence...',
    opsi_a: 'She go to school', opsi_b: 'She goes to school', opsi_c: 'She going to school', opsi_d: 'She gone to school', opsi_e: 'She goed to school',
    jawaban_benar: 'B', bobot: 1,
  },
  {
    id: 'sq13', id_ujian: 'uj3', nomor: 3,
    pertanyaan: 'What is the past tense of "eat"?',
    opsi_a: 'Eated', opsi_b: 'Eating', opsi_c: 'Eaten', opsi_d: 'Ate', opsi_e: 'Eats',
    jawaban_benar: 'D', bobot: 1,
  },
];

export const jadwalUjians: JadwalUjian[] = [
  {
    id: 'j1',
    id_ujian: 'uj1',
    ruangan: 'Lab Komputer 1',
    max_capacity: 70,
    waktu_mulai: '2026-07-09T08:00:00Z',
    waktu_selesai: '2026-07-09T10:00:00Z',
    status: 'Dibuka',
    status_publikasi: 'Published',
    siswa_ids: ['s1', 's2', 's3'],
  },
  {
    id: 'j2',
    id_ujian: 'uj2',
    ruangan: 'Lab Komputer 2',
    max_capacity: 70,
    waktu_mulai: '2026-07-09T10:30:00Z',
    waktu_selesai: '2026-07-09T12:00:00Z',
    status: 'Menunggu',
    status_publikasi: 'Draft',
    siswa_ids: ['s1', 's2', 's3', 's4', 's5'],
  },
  {
    id: 'j3',
    id_ujian: 'uj3',
    ruangan: 'Lab Komputer 1',
    max_capacity: 35,
    waktu_mulai: '2026-07-08T08:00:00Z',
    waktu_selesai: '2026-07-08T09:00:00Z',
    status: 'Ditutup',
    status_publikasi: 'Published',
    siswa_ids: ['s1', 's2'],
  },
];

// Nilai historis (sudah selesai)
export const nilaiList: Nilai[] = [
  {
    id: 'n1',
    id_session: 'ses3',
    id_siswa: 's1',
    id_jadwal: 'j3',
    jumlah_benar: 3,
    jumlah_salah: 1,
    jumlah_kosong: 1,
    nilai: 60,
    lulus: false,
    submitted_at: '2026-07-08T08:47:00Z',
  },
  {
    id: 'n2',
    id_session: 'ses4',
    id_siswa: 's2',
    id_jadwal: 'j3',
    jumlah_benar: 5,
    jumlah_salah: 0,
    jumlah_kosong: 0,
    nilai: 100,
    lulus: true,
    submitted_at: '2026-07-08T08:40:00Z',
  },
];

// ── Mutable State (runtime, in-memory) ──────────────────────

type Store = {
  users: User[];
  kelas: Kelas[];
  mataPelajaran: MataPelajaran[];
  siswas: Siswa[];
  gurus: Guru[];
  ujians: Ujian[];
  soals: Soal[];
  jadwalUjians: JadwalUjian[];
  sessions: SessionUjian[];
  jawabans: Jawaban[];
  nilaiList: Nilai[];
};

// Singleton mutable store — persists for entire browser session
let _store: Store | null = null;

export function getStore(): Store {
  if (!_store) {
    _store = {
      users:         [...users],
      kelas:         [...kelas],
      mataPelajaran: [...mataPelajaran],
      siswas:        [...siswas],
      gurus:         [...gurus],
      ujians:        [...ujians],
      soals:         [...soals],
      jadwalUjians:  [...jadwalUjians],
      sessions:      [],
      jawabans:      [],
      nilaiList:     [...nilaiList],
    };
  }
  return _store;
}

export function resetStore() {
  _store = null;
}

// ── CRUD Helpers ─────────────────────────────────────────────

export function findUserByCredentials(username: string, password: string): User | null {
  const s = getStore();
  return s.users.find(u => u.username === username && u.password === password && u.status === 'aktif') ?? null;
}

export function getSiswaByUserId(userId: string): Siswa | null {
  return getStore().siswas.find(s => s.id_user === userId) ?? null;
}

export function getGuruByUserId(userId: string): Guru | null {
  return getStore().gurus.find(g => g.id_user === userId) ?? null;
}

export function getSoalsByUjian(ujianId: string): Soal[] {
  return getStore().soals.filter(s => s.id_ujian === ujianId);
}

export function getJadwalAktifBySiswa(siswaId: string): JadwalUjian[] {
  const s = getStore();
  return s.jadwalUjians.filter(j =>
    j.status_publikasi === 'Published' &&
    (j.status === 'Dibuka' || j.status === 'Menunggu') &&
    j.siswa_ids.includes(siswaId)
  );
}

export function getHistoriNilai(siswaId: string): Nilai[] {
  return getStore().nilaiList.filter(n => n.id_siswa === siswaId);
}

export function getSessionBySiswaJadwal(siswaId: string, jadwalId: string): SessionUjian | null {
  return getStore().sessions.find(s => s.id_siswa === siswaId && s.id_jadwal === jadwalId) ?? null;
}

export function createSession(siswaId: string, jadwal: JadwalUjian, soalList: Soal[]): SessionUjian {
  const s = getStore();
  const ujian = s.ujians.find(u => u.id === jadwal.id_ujian)!;

  const orderedSoalIds = ujian.acak_soal
    ? shuffle(soalList.map(sq => sq.id))
    : soalList.map(sq => sq.id);

  const urutanOpsi: Record<string, JawabanBenar[]> = {};
  const opsiKeys: JawabanBenar[] = ['A', 'B', 'C', 'D', 'E'];
  soalList.forEach(sq => {
    urutanOpsi[sq.id] = ujian.acak_opsi ? shuffle([...opsiKeys]) : [...opsiKeys];
  });

  const now = new Date();
  const deadline = new Date(now.getTime() + ujian.durasi * 60 * 1000);

  const session: SessionUjian = {
    id: `ses_${Date.now()}`,
    id_jadwal: jadwal.id,
    id_siswa: siswaId,
    urutan_soal: orderedSoalIds,
    urutan_opsi: urutanOpsi,
    deadline: deadline.toISOString(),
    sisa_waktu: ujian.durasi * 60,
    status: 'berlangsung',
    started_at: now.toISOString(),
  };

  s.sessions.push(session);
  return session;
}

export function upsertJawaban(
  sessionId: string,
  soalId: string,
  jawaban: JawabanBenar | null,
  statusSoal: 'belum' | 'sudah' | 'ragu'
): void {
  const s = getStore();
  const existing = s.jawabans.find(j => j.id_session === sessionId && j.id_soal === soalId);

  if (existing) {
    existing.jawaban_siswa = jawaban;
    existing.status_soal = statusSoal;
    existing.waktu_jawab = new Date().toISOString();
  } else {
    s.jawabans.push({
      id: `j_${Date.now()}_${Math.random()}`,
      id_session: sessionId,
      id_soal: soalId,
      jawaban_siswa: jawaban,
      benar_salah: null,
      waktu_jawab: new Date().toISOString(),
      status_soal: statusSoal,
    });
  }
}

export function submitSession(sessionId: string): Nilai {
  const s = getStore();
  const session = s.sessions.find(ses => ses.id === sessionId)!;
  const jadwal = s.jadwalUjians.find(j => j.id === session.id_jadwal)!;
  const ujian = s.ujians.find(u => u.id === jadwal.id_ujian)!;
  const soalList = getSoalsByUjian(ujian.id);

  let jumlah_benar = 0;
  let jumlah_salah = 0;
  let jumlah_kosong = 0;
  let total_bobot = 0;
  let bobot_benar = 0;

  soalList.forEach(soal => {
    const jawaban = s.jawabans.find(j => j.id_session === sessionId && j.id_soal === soal.id);
    total_bobot += soal.bobot;
    if (!jawaban || jawaban.jawaban_siswa === null) {
      jumlah_kosong++;
      if (jawaban) jawaban.benar_salah = false;
    } else {
      // Map shuffled opsi back to original
      const opsiUrutan = session.urutan_opsi[soal.id] ?? ['A','B','C','D','E'];
      const opsiKeys: JawabanBenar[] = ['A','B','C','D','E'];
      const originalKeys: Record<string, JawabanBenar> = {};
      opsiUrutan.forEach((originalKey, idx) => {
        originalKeys[opsiKeys[idx]] = originalKey;
      });
      const originalJawaban = originalKeys[jawaban.jawaban_siswa] ?? jawaban.jawaban_siswa;
      const benar = originalJawaban === soal.jawaban_benar;
      jawaban.benar_salah = benar;
      if (benar) { jumlah_benar++; bobot_benar += soal.bobot; }
      else jumlah_salah++;
    }
  });

  const nilai_angka = total_bobot > 0 ? Math.round((bobot_benar / total_bobot) * 100 * 100) / 100 : 0;

  session.status = 'selesai';

  const nilaiObj: Nilai = {
    id: `n_${Date.now()}`,
    id_session: sessionId,
    id_siswa: session.id_siswa,
    id_jadwal: session.id_jadwal,
    jumlah_benar,
    jumlah_salah,
    jumlah_kosong,
    nilai: nilai_angka,
    lulus: nilai_angka >= ujian.nilai_kkm,
    submitted_at: new Date().toISOString(),
  };

  s.nilaiList.push(nilaiObj);
  return nilaiObj;
}

export function getMonitoringData(jadwalId: string) {
  const s = getStore();
  const jadwal = s.jadwalUjians.find(j => j.id === jadwalId);
  if (!jadwal) return [];

  const ujian = s.ujians.find(u => u.id === jadwal.id_ujian);
  const totalSoal = ujian ? getSoalsByUjian(ujian.id).length : 0;

  return jadwal.siswa_ids.map(siswaId => {
    const siswa = s.siswas.find(sv => sv.id === siswaId)!;
    const session = s.sessions.find(ses => ses.id_siswa === siswaId && ses.id_jadwal === jadwalId);
    const jawabanSiswa = session
      ? s.jawabans.filter(j => j.id_session === session.id && j.jawaban_siswa !== null)
      : [];
    const jumlah_dijawab = jawabanSiswa.length;
    const progress_persen = totalSoal > 0 ? Math.round((jumlah_dijawab / totalSoal) * 100) : 0;

    return {
      siswa,
      session,
      jumlah_dijawab,
      progress_persen,
      status: session ? session.status : ('belum_masuk' as StatusSession | 'belum_masuk'),
    };
  });
}

export function forceSubmitSession(sessionId: string): void {
  const s = getStore();
  const session = s.sessions.find(ses => ses.id === sessionId);
  if (session && session.status === 'berlangsung') {
    session.status = 'force_submit';
    submitSession(sessionId);
  }
}

// ── Proktor: Buka / Tutup Jadwal ─────────────────────────────

export function bukaJadwal(jadwalId: string, proktorId: string): void {
  const s = getStore();
  const jadwal = s.jadwalUjians.find(j => j.id === jadwalId);
  if (!jadwal) return;
  if (jadwal.status !== 'Menunggu') return;
  // simpan siapa yang membuka (extend type di runtime, tidak merusak interface)
  (jadwal as JadwalUjian & { dibuka_oleh?: string }).dibuka_oleh = proktorId;
  jadwal.status = 'Dibuka';
}

export function tutupJadwal(jadwalId: string): void {
  const s = getStore();
  const jadwal = s.jadwalUjians.find(j => j.id === jadwalId);
  if (!jadwal) return;
  if (jadwal.status !== 'Dibuka') return;
  jadwal.status = 'Ditutup';
  // Force-submit semua sesi yang masih berlangsung
  const sessiBerlangsung = s.sessions.filter(
    ses => ses.id_jadwal === jadwalId && ses.status === 'berlangsung'
  );
  sessiBerlangsung.forEach(ses => {
    ses.status = 'force_submit';
    submitSession(ses.id);
  });
}

// ── Auto-timeout sweep ───────────────────────────────────────

export function autoTimeoutSweep(): void {
  const s = getStore();
  const now = new Date();
  const expired = s.sessions.filter(ses => {
    if (ses.status !== 'berlangsung') return false;
    return new Date(ses.deadline) <= now;
  });
  expired.forEach(ses => {
    ses.status = 'force_submit';
    submitSession(ses.id);
  });
}

// ── Proktor: CRUD Jadwal ──────────────────────────────────────

export interface CreateJadwalInput {
  id_ujian: string;
  ruangan: string;
  max_capacity: number;
  waktu_mulai: string;
  waktu_selesai: string;
  siswa_ids: string[];
}

export function createJadwal(input: CreateJadwalInput): JadwalUjian {
  const s = getStore();
  const jadwal: JadwalUjian = {
    id: `jdw_${Date.now()}`,
    id_ujian: input.id_ujian,
    ruangan: input.ruangan,
    max_capacity: input.max_capacity,
    waktu_mulai: input.waktu_mulai,
    waktu_selesai: input.waktu_selesai,
    status: 'Menunggu',
    status_publikasi: 'Draft',
    siswa_ids: [...input.siswa_ids],
  };
  s.jadwalUjians.push(jadwal);
  return jadwal;
}

export function publishJadwal(id: string): void {
  const s = getStore();
  const jadwal = s.jadwalUjians.find(j => j.id === id);
  if (!jadwal) return;
  jadwal.status_publikasi = 'Published';
}

export function unpublishJadwal(id: string): { ok: boolean; error?: string } {
  const s = getStore();
  const jadwal = s.jadwalUjians.find(j => j.id === id);
  if (!jadwal) return { ok: false, error: 'Jadwal tidak ditemukan.' };
  // Cek apakah sudah ada session
  const hasSession = s.sessions.some(ses => ses.id_jadwal === id);
  if (hasSession) return { ok: false, error: 'Ujian tidak dapat dibatalkan publikasinya karena sudah ada peserta yang memulai ujian.' };
  jadwal.status_publikasi = 'Draft';
  return { ok: true };
}

export function updateJadwal(id: string, input: Partial<CreateJadwalInput>): void {
  const s = getStore();
  const jadwal = s.jadwalUjians.find(j => j.id === id);
  if (!jadwal || jadwal.status !== 'Menunggu') return;
  if (input.id_ujian     !== undefined) jadwal.id_ujian      = input.id_ujian;
  if (input.ruangan      !== undefined) jadwal.ruangan       = input.ruangan;
  if (input.max_capacity !== undefined) jadwal.max_capacity  = input.max_capacity;
  if (input.waktu_mulai  !== undefined) jadwal.waktu_mulai   = input.waktu_mulai;
  if (input.waktu_selesai !== undefined) jadwal.waktu_selesai = input.waktu_selesai;
  if (input.siswa_ids    !== undefined) jadwal.siswa_ids     = [...input.siswa_ids];
}

export function deleteJadwal(id: string): boolean {
  const s = getStore();
  const idx = s.jadwalUjians.findIndex(j => j.id === id);
  if (idx === -1) return false;
  const jadwal = s.jadwalUjians[idx];
  // Hanya boleh hapus jika belum ada siswa yang join (ada session)
  const hasSession = s.sessions.some(ses => ses.id_jadwal === id);
  if (hasSession) return false;
  s.jadwalUjians.splice(idx, 1);
  return true;
}

// ── Proktor: CRUD User / Siswa / Guru ────────────────────────

export function createUser(data: Omit<User, 'id'>): User {
  const s = getStore();
  const user: User = { id: `usr_${Date.now()}`, ...data };
  s.users.push(user);
  return user;
}

export function updateUser(id: string, data: Partial<Omit<User, 'id'>>): void {
  const s = getStore();
  const u = s.users.find(x => x.id === id);
  if (!u) return;
  Object.assign(u, data);
}

export function toggleUserStatus(id: string): void {
  const s = getStore();
  const u = s.users.find(x => x.id === id);
  if (!u) return;
  u.status = u.status === 'aktif' ? 'nonaktif' : 'aktif';
}

export function resetPassword(id: string, newPassword: string): void {
  const s = getStore();
  const u = s.users.find(x => x.id === id);
  if (u) u.password = newPassword;
}

export function createSiswa(data: { nis: string; nama: string; id_kelas: string; username: string; password: string }): Siswa {
  const s = getStore();
  const user = createUser({ username: data.username, password: data.password, role: 'siswa', status: 'aktif', nama: data.nama });
  const siswa: Siswa = { id: `sw_${Date.now()}`, nis: data.nis, nama: data.nama, id_kelas: data.id_kelas, id_user: user.id };
  s.siswas.push(siswa);
  return siswa;
}

export function updateSiswa(id: string, data: Partial<{ nis: string; nama: string; id_kelas: string }>): void {
  const s = getStore();
  const siswa = s.siswas.find(x => x.id === id);
  if (!siswa) return;
  Object.assign(siswa, data);
  // Sync nama ke user
  if (data.nama) {
    const u = s.users.find(x => x.id === siswa.id_user);
    if (u) u.nama = data.nama;
  }
}

export function deleteSiswa(id: string): boolean {
  const s = getStore();
  const idx = s.siswas.findIndex(x => x.id === id);
  if (idx === -1) return false;
  const siswa = s.siswas[idx];
  s.siswas.splice(idx, 1);
  // Hapus user terkait
  const uIdx = s.users.findIndex(x => x.id === siswa.id_user);
  if (uIdx !== -1) s.users.splice(uIdx, 1);
  return true;
}

export function createGuru(data: { nip: string; nama: string; mapel_ids: string[]; username: string; password: string }): Guru {
  const s = getStore();
  const user = createUser({ username: data.username, password: data.password, role: 'guru', status: 'aktif', nama: data.nama });
  const guru: Guru = { id: `gr_${Date.now()}`, nip: data.nip, nama: data.nama, id_user: user.id, mapel_ids: [...data.mapel_ids] };
  s.gurus.push(guru);
  return guru;
}

export function updateGuru(id: string, data: Partial<{ nip: string; nama: string; mapel_ids: string[] }>): void {
  const s = getStore();
  const guru = s.gurus.find(x => x.id === id);
  if (!guru) return;
  if (data.nip)       guru.nip = data.nip;
  if (data.nama)      { guru.nama = data.nama; const u = s.users.find(x => x.id === guru.id_user); if (u) u.nama = data.nama; }
  if (data.mapel_ids) guru.mapel_ids = [...data.mapel_ids];
}

export function deleteGuru(id: string): boolean {
  const s = getStore();
  const idx = s.gurus.findIndex(x => x.id === id);
  if (idx === -1) return false;
  const guru = s.gurus[idx];
  // Cek apakah guru punya ujian aktif (ada jadwal berlangsung)
  const hasActiveUjian = s.ujians.some(u => u.id_guru === id &&
    s.jadwalUjians.some(j => j.id_ujian === u.id && j.status === 'Dibuka')
  );
  if (hasActiveUjian) return false;
  s.gurus.splice(idx, 1);
  const uIdx = s.users.findIndex(x => x.id === guru.id_user);
  if (uIdx !== -1) s.users.splice(uIdx, 1);
  return true;
}

// ── Guru: CRUD Ujian ──────────────────────────────────────────

export interface CreateUjianInput {
  nama_ujian: string;
  id_mapel: string;
  id_guru: string;
  jenis_ujian: Ujian['jenis_ujian'];
  durasi: number;
  nilai_kkm: number;
  acak_soal: boolean;
  acak_opsi: boolean;
  tampil_hasil: boolean;
  kelas_ids: string[];
}

export function createUjian(input: CreateUjianInput): Ujian {
  const s = getStore();
  const ujian: Ujian = {
    id: `uj_${Date.now()}`,
    ...input,
    created_at: new Date().toISOString(),
  };
  s.ujians.push(ujian);
  return ujian;
}

export function updateUjian(id: string, input: Partial<CreateUjianInput>): void {
  const s = getStore();
  const ujian = s.ujians.find(u => u.id === id);
  if (!ujian) return;
  Object.assign(ujian, input);
}

export function deleteUjian(id: string): boolean {
  const s = getStore();
  // Tidak boleh hapus jika ada jadwal aktif
  const hasActiveJadwal = s.jadwalUjians.some(j => j.id_ujian === id && j.status !== 'Ditutup');
  if (hasActiveJadwal) return false;
  // Cascade: hapus soal
  s.soals = s.soals.filter(sq => sq.id_ujian !== id);
  // Cascade: hapus jadwal yang sudah ditutup
  s.jadwalUjians = s.jadwalUjians.filter(j => j.id_ujian !== id);
  const idx = s.ujians.findIndex(u => u.id === id);
  if (idx !== -1) s.ujians.splice(idx, 1);
  return true;
}
