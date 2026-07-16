-- ============================================================
-- UMBK — MTS WAHA — PostgreSQL Schema (Docker, tanpa Supabase)
-- Tidak ada dependency ke auth.users — auth dikelola sendiri
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Enum Types ───────────────────────────────────────────────
CREATE TYPE role_enum             AS ENUM ('admin', 'proktor', 'guru', 'siswa');
CREATE TYPE status_akun_enum      AS ENUM ('aktif', 'nonaktif');
CREATE TYPE jenis_ujian_enum      AS ENUM ('UMBK', 'UAS', 'PAS', 'PTS', 'TRYOUT', 'LATIHAN');
CREATE TYPE jawaban_benar_enum    AS ENUM ('A', 'B', 'C', 'D', 'E');
CREATE TYPE status_publikasi_enum AS ENUM ('Draft', 'Published');
CREATE TYPE status_session_enum   AS ENUM ('belum_mulai', 'berlangsung', 'selesai', 'force_submit');
CREATE TYPE status_soal_enum      AS ENUM ('belum', 'sudah', 'ragu');

-- ── Tabel: profiles ──────────────────────────────────────────
-- Menggantikan auth.users + profiles Supabase; auth dikelola sendiri
CREATE TABLE profiles (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username    TEXT NOT NULL UNIQUE,
  password    TEXT NOT NULL,           -- bcrypt hash
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
  durasi        INTEGER NOT NULL DEFAULT 90,
  nilai_kkm     INTEGER NOT NULL DEFAULT 75,
  acak_soal     BOOLEAN NOT NULL DEFAULT TRUE,
  acak_opsi     BOOLEAN NOT NULL DEFAULT TRUE,
  tampil_hasil  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabel: ujian_kelas ───────────────────────────────────────
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
  opsi_a_img      TEXT,
  opsi_b_img      TEXT,
  opsi_c_img      TEXT,
  opsi_d_img      TEXT,
  jawaban_benar   jawaban_benar_enum NOT NULL,
  bobot           NUMERIC(5,2) NOT NULL DEFAULT 1,
  gambar_url      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_ujian, nomor)
);

-- ── Tabel: jadwal_ujians ─────────────────────────────────────
CREATE TABLE jadwal_ujians (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_ujian          UUID NOT NULL REFERENCES ujians(id) ON DELETE RESTRICT,
  max_capacity      INTEGER NOT NULL DEFAULT 40,
  durasi_menit      INTEGER NOT NULL,
  status_publikasi  status_publikasi_enum NOT NULL DEFAULT 'Draft',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabel: jadwal_siswa ──────────────────────────────────────
CREATE TABLE jadwal_siswa (
  jadwal_id  UUID NOT NULL REFERENCES jadwal_ujians(id) ON DELETE CASCADE,
  siswa_id   UUID NOT NULL REFERENCES siswas(id) ON DELETE CASCADE,
  PRIMARY KEY (jadwal_id, siswa_id)
);

-- ── Tabel: session_ujians ────────────────────────────────────
CREATE TABLE session_ujians (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_jadwal     UUID NOT NULL REFERENCES jadwal_ujians(id) ON DELETE CASCADE,
  id_siswa      UUID NOT NULL REFERENCES siswas(id) ON DELETE CASCADE,
  urutan_soal   JSONB NOT NULL DEFAULT '[]',
  urutan_opsi   JSONB NOT NULL DEFAULT '{}',
  deadline      TIMESTAMPTZ NOT NULL,
  sisa_waktu    INTEGER NOT NULL,
  status        status_session_enum NOT NULL DEFAULT 'berlangsung',
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Tabel: jawabans ──────────────────────────────────────────
CREATE TABLE jawabans (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_session      UUID NOT NULL REFERENCES session_ujians(id) ON DELETE CASCADE,
  id_soal         UUID NOT NULL REFERENCES soals(id) ON DELETE CASCADE,
  jawaban_siswa   jawaban_benar_enum,
  status_soal     status_soal_enum NOT NULL DEFAULT 'belum',
  benar_salah     BOOLEAN,
  waktu_jawab     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (id_session, id_soal)
);

-- ── Tabel: nilai ─────────────────────────────────────────────
CREATE TABLE nilai (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  id_session      UUID NOT NULL REFERENCES session_ujians(id) ON DELETE CASCADE,
  id_siswa        UUID NOT NULL REFERENCES siswas(id) ON DELETE CASCADE,
  id_jadwal       UUID NOT NULL REFERENCES jadwal_ujians(id) ON DELETE CASCADE,
  jumlah_benar    INTEGER NOT NULL DEFAULT 0,
  jumlah_salah    INTEGER NOT NULL DEFAULT 0,
  jumlah_kosong   INTEGER NOT NULL DEFAULT 0,
  nilai           NUMERIC(5,2) NOT NULL DEFAULT 0,
  lulus           BOOLEAN NOT NULL DEFAULT FALSE,
  submitted_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX idx_profiles_username      ON profiles(username);
CREATE INDEX idx_siswas_id_user         ON siswas(id_user);
CREATE INDEX idx_siswas_id_kelas        ON siswas(id_kelas);
CREATE INDEX idx_gurus_id_user          ON gurus(id_user);
CREATE INDEX idx_ujians_id_guru         ON ujians(id_guru);
CREATE INDEX idx_ujian_kelas_ujian      ON ujian_kelas(ujian_id);
CREATE INDEX idx_ujian_kelas_kelas      ON ujian_kelas(kelas_id);
CREATE INDEX idx_jadwal_ujians_ujian    ON jadwal_ujians(id_ujian);
CREATE INDEX idx_jadwal_siswa_jadwal    ON jadwal_siswa(jadwal_id);
CREATE INDEX idx_jadwal_siswa_siswa     ON jadwal_siswa(siswa_id);
CREATE INDEX idx_session_jadwal         ON session_ujians(id_jadwal);
CREATE INDEX idx_session_siswa          ON session_ujians(id_siswa);
CREATE INDEX idx_jawabans_session       ON jawabans(id_session);
CREATE INDEX IF NOT EXISTS idx_jawabans_session_jawaban
  ON jawabans(id_session, jawaban_siswa)
  WHERE jawaban_siswa IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jawabans_session_soal
  ON jawabans(id_session, id_soal);
CREATE INDEX idx_nilai_siswa            ON nilai(id_siswa);
CREATE INDEX idx_nilai_jadwal           ON nilai(id_jadwal);
