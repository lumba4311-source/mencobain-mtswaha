// ============================================================
// UMBK — MTS WAHA — Type Definitions
// ============================================================

export type Role = 'admin' | 'proktor' | 'guru' | 'siswa';
export type StatusAkun = 'aktif' | 'nonaktif';
export type JenisUjian = 'UMBK' | 'UAS' | 'PAS' | 'PTS' | 'TRYOUT' | 'LATIHAN';
export type JawabanBenar = 'A' | 'B' | 'C' | 'D' | 'E';
export type StatusJadwal    = 'Menunggu' | 'Dibuka' | 'Ditutup';
export type StatusPublikasi = 'Draft' | 'Published';
export type StatusSession = 'belum_mulai' | 'berlangsung' | 'selesai' | 'force_submit';
export type StatusSoal = 'belum' | 'sudah' | 'ragu';

// ── Master Data ──────────────────────────────────────────────

export interface User {
  id: string;
  username: string;
  password: string; // plain text for mock
  role: Role;
  status: StatusAkun;
  nama: string;
}

export interface Kelas {
  id: string;
  nama_kelas: string;
  tingkat: number;
  tahun_ajaran: string;
}

export interface MataPelajaran {
  id: string;
  nama_mapel: string;
  kelompok: 'umum' | 'pesantren';
}

export interface Siswa {
  id: string;
  nis: string;
  nama: string;
  id_kelas: string;
  id_user: string;
}

export interface Guru {
  id: string;
  nip: string;
  nama: string;
  id_user: string;
  mapel_ids: string[]; // relasi guru_mapel
}

// ── Konten Ujian ─────────────────────────────────────────────

export interface Ujian {
  id: string;
  nama_ujian: string;
  id_mapel: string;
  id_guru: string;
  jenis_ujian: JenisUjian;
  durasi: number; // menit
  nilai_kkm: number;
  acak_soal: boolean;
  acak_opsi: boolean;
  tampil_hasil: boolean;
  kelas_ids: string[]; // relasi ujian_kelas
  created_at: string;
}

export interface Soal {
  id: string;
  id_ujian: string;
  pertanyaan: string;
  opsi_a: string;
  opsi_b: string;
  opsi_c: string;
  opsi_d: string;
  opsi_e: string;
  jawaban_benar: JawabanBenar;
  bobot: number;
  gambar_url?: string;
  nomor: number;
}

// ── Operasional Ujian ────────────────────────────────────────

export interface JadwalUjian {
  id: string;
  id_ujian: string;
  ruangan: string;
  max_capacity: number;
  waktu_mulai: string;
  waktu_selesai: string;
  status: StatusJadwal;
  status_publikasi: StatusPublikasi;
  siswa_ids: string[]; // peserta yang di-assign
}

export interface SessionUjian {
  id: string;
  id_jadwal: string;
  id_siswa: string;
  urutan_soal: string[];   // ordered soal IDs (Fisher-Yates)
  urutan_opsi: Record<string, JawabanBenar[]>; // soal_id -> shuffled opsi keys
  deadline: string;        // ISO string
  sisa_waktu: number;      // detik
  status: StatusSession;
  started_at?: string;
}

export interface Jawaban {
  id: string;
  id_session: string;
  id_soal: string;
  jawaban_siswa: JawabanBenar | null;
  benar_salah: boolean | null;
  waktu_jawab: string;
  status_soal: StatusSoal;
}

export interface Nilai {
  id: string;
  id_session: string;
  id_siswa: string;
  id_jadwal: string;
  jumlah_benar: number;
  jumlah_salah: number;
  jumlah_kosong: number;
  nilai: number;
  lulus: boolean;
  submitted_at: string;
}

// ── UI State ─────────────────────────────────────────────────

export interface AuthState {
  user: User | null;
  siswa?: Siswa | null;
  guru?: Guru | null;
}

export interface ExamState {
  session: SessionUjian;
  soalList: Soal[];
  jawaban: Record<string, Jawaban>; // soal_id -> jawaban
  currentIndex: number;
  timeLeft: number; // detik
  submitted: boolean;
  result?: Nilai;
}

// ── Monitoring (Proktor) ─────────────────────────────────────

export interface MonitoringSiswa {
  siswa: Siswa;
  session?: SessionUjian;
  jumlah_dijawab: number;
  progress_persen: number;
  status: StatusSession | 'belum_masuk';
}
