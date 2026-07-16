// ============================================================
// UMBK — MTS WAHA — Type Definitions
// ============================================================

export type Role = 'admin' | 'proktor' | 'guru' | 'siswa';
export type StatusAkun = 'aktif' | 'nonaktif';
export type JenisUjian = 'UMBK' | 'UAS' | 'PAS' | 'PTS' | 'TRYOUT' | 'LATIHAN';
export type JawabanBenar = 'A' | 'B' | 'C' | 'D' | 'E';
export type StatusPublikasi = 'Draft' | 'Published';
export type StatusSession = 'belum_mulai' | 'berlangsung' | 'selesai' | 'force_submit';
export type StatusSoal = 'belum' | 'sudah' | 'ragu';

export interface User {
  id: string;
  username: string;
  password_plain?: string; // plain-text password — hanya dikembalikan ke proktor/admin
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

export interface Siswa {
  id: string;
  nis: string;
  nama: string;
  id_kelas: string;
  id_user: string;
  nama_kelas?: string;
}

export interface Guru {
  id: string;
  nip: string;
  nama: string;
  id_user: string;
}

// ── Konten Ujian ─────────────────────────────────────────────

export interface Ujian {
  id: string;
  nama_ujian: string;
  id_guru: string;
  jenis_ujian: JenisUjian;
  durasi: number;
  acak_soal: boolean;
  acak_opsi: boolean;
  tampil_hasil: boolean;
  kelas_ids: string[];       // di-flatten dari tabel ujian_kelas oleh API
  soal_count?: number;       // dihitung dari soals oleh API
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
  opsi_a_img?: string; // gambar opsional untuk opsi A
  opsi_b_img?: string; // gambar opsional untuk opsi B
  opsi_c_img?: string; // gambar opsional untuk opsi C
  opsi_d_img?: string; // gambar opsional untuk opsi D
  jawaban_benar: JawabanBenar;
  bobot: number;
  gambar_url?: string;
  nomor: number;
}

// ── Operasional Ujian ────────────────────────────────────────

export interface JadwalUjian {
  id: string;
  id_ujian: string;
  max_capacity: number;
  waktu_mulai?: string;      // tidak lagi digunakan
  waktu_selesai?: string;    // tidak lagi digunakan
  durasi_menit: number;      // durasi pengerjaan dalam menit
  status_publikasi: StatusPublikasi;
  siswa_ids: string[];
  created_at?: string;
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
