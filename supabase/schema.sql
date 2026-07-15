-- ============================================================
-- UMBK — MTS WAHA — Supabase PostgreSQL Schema
-- Jalankan file ini di Supabase Dashboard > SQL Editor
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Enum Types ───────────────────────────────────────────────
CREATE TYPE role_enum            AS ENUM ('admin', 'proktor', 'guru', 'siswa');
CREATE TYPE status_akun_enum     AS ENUM ('aktif', 'nonaktif');
CREATE TYPE jenis_ujian_enum     AS ENUM ('UMBK', 'UAS', 'PAS', 'PTS', 'TRYOUT', 'LATIHAN');
CREATE TYPE jawaban_benar_enum   AS ENUM ('A', 'B', 'C', 'D', 'E');
CREATE TYPE status_publikasi_enum AS ENUM ('Draft', 'Published');
CREATE TYPE status_session_enum  AS ENUM ('belum_mulai', 'berlangsung', 'selesai', 'force_submit');
CREATE TYPE status_soal_enum     AS ENUM ('belum', 'sudah', 'ragu');

-- ── Tabel: profiles ──────────────────────────────────────────
-- Extend tabel auth.users bawaan Supabase dengan data profil
CREATE TABLE profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username    TEXT NOT NULL UNIQUE,
  nama        TEXT NOT NULL,
  role        role_enum NOT NULL,
  status      status_akun_enum NOT NULL DEFAULT 'aktif',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabel: kelas ─────────────────────────────────────────────
CREATE TABLE kelas (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama_kelas    TEXT NOT NULL,
  tingkat       INTEGER NOT NULL,
  tahun_ajaran  TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabel: siswas ────────────────────────────────────────────
CREATE TABLE siswas (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nis         TEXT NOT NULL UNIQUE,
  nama        TEXT NOT NULL,
  id_kelas    UUID NOT NULL REFERENCES kelas(id) ON DELETE RESTRICT,
  id_user     UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabel: gurus ─────────────────────────────────────────────
CREATE TABLE gurus (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nip         TEXT NOT NULL UNIQUE,
  nama        TEXT NOT NULL,
  id_user     UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabel: ujians ────────────────────────────────────────────
CREATE TABLE ujians (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nama_ujian    TEXT NOT NULL,
  id_guru       UUID NOT NULL REFERENCES gurus(id) ON DELETE RESTRICT,
  jenis_ujian   jenis_ujian_enum NOT NULL,
  durasi        INTEGER NOT NULL DEFAULT 90,        -- menit
  nilai_kkm     INTEGER NOT NULL DEFAULT 75,
  acak_soal     BOOLEAN NOT NULL DEFAULT TRUE,
  acak_opsi     BOOLEAN NOT NULL DEFAULT TRUE,
  tampil_hasil  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabel: ujian_kelas (relasi many-to-many) ─────────────────
-- Menggantikan array kelas_ids[] di Ujian
CREATE TABLE ujian_kelas (
  ujian_id  UUID NOT NULL REFERENCES ujians(id) ON DELETE CASCADE,
  kelas_id  UUID NOT NULL REFERENCES kelas(id) ON DELETE CASCADE,
  PRIMARY KEY (ujian_id, kelas_id)
);

-- ── Tabel: soals ─────────────────────────────────────────────
CREATE TABLE soals (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_ujian        UUID NOT NULL REFERENCES ujians(id) ON DELETE CASCADE,
  nomor           INTEGER NOT NULL,
  pertanyaan      TEXT NOT NULL,
  opsi_a          TEXT NOT NULL,
  opsi_b          TEXT NOT NULL,
  opsi_c          TEXT NOT NULL,
  opsi_d          TEXT NOT NULL,
  jawaban_benar   jawaban_benar_enum NOT NULL,
  bobot           NUMERIC(5,2) NOT NULL DEFAULT 1,
  gambar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_ujian, nomor)
);

-- ── Tabel: jadwal_ujians ─────────────────────────────────────
CREATE TABLE jadwal_ujians (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_ujian            UUID NOT NULL REFERENCES ujians(id) ON DELETE RESTRICT,
  max_capacity        INTEGER NOT NULL DEFAULT 40,
  durasi_menit        INTEGER NOT NULL,
  status_publikasi    status_publikasi_enum NOT NULL DEFAULT 'Draft',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabel: jadwal_siswa (relasi many-to-many) ────────────────
-- Menggantikan array siswa_ids[] di JadwalUjian
CREATE TABLE jadwal_siswa (
  jadwal_id  UUID NOT NULL REFERENCES jadwal_ujians(id) ON DELETE CASCADE,
  siswa_id   UUID NOT NULL REFERENCES siswas(id) ON DELETE CASCADE,
  PRIMARY KEY (jadwal_id, siswa_id)
);

-- ── Tabel: session_ujians ────────────────────────────────────
CREATE TABLE session_ujians (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_jadwal     UUID NOT NULL REFERENCES jadwal_ujians(id) ON DELETE RESTRICT,
  id_siswa      UUID NOT NULL REFERENCES siswas(id) ON DELETE RESTRICT,
  urutan_soal   JSONB NOT NULL DEFAULT '[]',   -- ordered array of soal UUIDs
  urutan_opsi   JSONB NOT NULL DEFAULT '{}',   -- soal_id -> ['A','B','C','D','E']
  deadline      TIMESTAMPTZ NOT NULL,
  sisa_waktu    INTEGER NOT NULL,              -- detik
  status        status_session_enum NOT NULL DEFAULT 'berlangsung',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_jadwal, id_siswa)
);

-- ── Tabel: jawabans ──────────────────────────────────────────
CREATE TABLE jawabans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_session      UUID NOT NULL REFERENCES session_ujians(id) ON DELETE CASCADE,
  id_soal         UUID NOT NULL REFERENCES soals(id) ON DELETE CASCADE,
  jawaban_siswa   jawaban_benar_enum,          -- NULL = belum dijawab
  benar_salah     BOOLEAN,
  status_soal     status_soal_enum NOT NULL DEFAULT 'belum',
  waktu_jawab     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_session, id_soal)
);

-- ── Tabel: nilai ─────────────────────────────────────────────
CREATE TABLE nilai (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_session      UUID NOT NULL UNIQUE REFERENCES session_ujians(id) ON DELETE CASCADE,
  id_siswa        UUID NOT NULL REFERENCES siswas(id) ON DELETE RESTRICT,
  id_jadwal       UUID NOT NULL REFERENCES jadwal_ujians(id) ON DELETE RESTRICT,
  jumlah_benar    INTEGER NOT NULL DEFAULT 0,
  jumlah_salah    INTEGER NOT NULL DEFAULT 0,
  jumlah_kosong   INTEGER NOT NULL DEFAULT 0,
  nilai           NUMERIC(5,2) NOT NULL DEFAULT 0,
  lulus           BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Row Level Security (RLS) ─────────────────────────────────
-- Aktifkan RLS di semua tabel
ALTER TABLE profiles        ENABLE ROW LEVEL SECURITY;
ALTER TABLE kelas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE siswas          ENABLE ROW LEVEL SECURITY;
ALTER TABLE gurus           ENABLE ROW LEVEL SECURITY;
ALTER TABLE ujians          ENABLE ROW LEVEL SECURITY;
ALTER TABLE ujian_kelas     ENABLE ROW LEVEL SECURITY;
ALTER TABLE soals           ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_ujians   ENABLE ROW LEVEL SECURITY;
ALTER TABLE jadwal_siswa    ENABLE ROW LEVEL SECURITY;
ALTER TABLE session_ujians  ENABLE ROW LEVEL SECURITY;
ALTER TABLE jawabans        ENABLE ROW LEVEL SECURITY;
ALTER TABLE nilai           ENABLE ROW LEVEL SECURITY;

-- Semua akses data melalui API Routes yang memakai service_role key
-- sehingga RLS bypass otomatis. Policy di bawah hanya untuk keamanan tambahan.

-- Izinkan service_role (API Routes) akses penuh semua tabel
CREATE POLICY "service_role full access" ON profiles        FOR ALL USING (true);
CREATE POLICY "service_role full access" ON kelas           FOR ALL USING (true);
CREATE POLICY "service_role full access" ON siswas          FOR ALL USING (true);
CREATE POLICY "service_role full access" ON gurus           FOR ALL USING (true);
CREATE POLICY "service_role full access" ON ujians          FOR ALL USING (true);
CREATE POLICY "service_role full access" ON ujian_kelas     FOR ALL USING (true);
CREATE POLICY "service_role full access" ON soals           FOR ALL USING (true);
CREATE POLICY "service_role full access" ON jadwal_ujians   FOR ALL USING (true);
CREATE POLICY "service_role full access" ON jadwal_siswa    FOR ALL USING (true);
CREATE POLICY "service_role full access" ON session_ujians  FOR ALL USING (true);
CREATE POLICY "service_role full access" ON jawabans        FOR ALL USING (true);
CREATE POLICY "service_role full access" ON nilai           FOR ALL USING (true);

-- ── Trigger: auto-create profile saat user baru daftar ───────
-- Function dibuat di schema auth agar bisa dipanggil dari trigger auth.users
-- SET search_path memastikan public.role_enum dan public.status_akun_enum bisa diakses
CREATE OR REPLACE FUNCTION auth.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, nama, role, status)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data->>'username',
    NEW.raw_user_meta_data->>'nama',
    (NEW.raw_user_meta_data->>'role')::public.role_enum,
    COALESCE((NEW.raw_user_meta_data->>'status')::public.status_akun_enum, 'aktif'::public.status_akun_enum)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auth.handle_new_user();

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_siswas_id_kelas     ON siswas(id_kelas);
CREATE INDEX idx_siswas_id_user      ON siswas(id_user);
CREATE INDEX idx_gurus_id_user       ON gurus(id_user);
CREATE INDEX idx_soals_id_ujian      ON soals(id_ujian);
CREATE INDEX idx_ujian_kelas_ujian   ON ujian_kelas(ujian_id);
CREATE INDEX idx_ujian_kelas_kelas   ON ujian_kelas(kelas_id);
CREATE INDEX idx_jadwal_ujians_ujian ON jadwal_ujians(id_ujian);
CREATE INDEX idx_jadwal_siswa_jadwal ON jadwal_siswa(jadwal_id);
CREATE INDEX idx_jadwal_siswa_siswa  ON jadwal_siswa(siswa_id);
CREATE INDEX idx_session_jadwal      ON session_ujians(id_jadwal);
CREATE INDEX idx_session_siswa       ON session_ujians(id_siswa);
CREATE INDEX idx_jawabans_session    ON jawabans(id_session);
-- P7: composite index untuk query monitoring (filter jawaban tidak null per session)
CREATE INDEX IF NOT EXISTS idx_jawabans_session_jawaban
  ON jawabans(id_session, jawaban_siswa)
  WHERE jawaban_siswa IS NOT NULL;
-- P7: composite index untuk query penilaian (lookup per session+soal)
CREATE INDEX IF NOT EXISTS idx_jawabans_session_soal
  ON jawabans(id_session, id_soal);
CREATE INDEX idx_nilai_siswa         ON nilai(id_siswa);
CREATE INDEX idx_nilai_jadwal        ON nilai(id_jadwal);
