-- ============================================================
-- UMBK — MTS WAHA — Seed Data
-- Jalankan SETELAH schema.sql
-- CATATAN: Buat user via Supabase Auth terlebih dahulu,
--          lalu ganti UUID placeholder di bawah dengan UUID asli
--          dari tabel auth.users di Supabase Dashboard
-- ============================================================

-- Cara membuat user di Supabase Auth:
-- 1. Buka Supabase Dashboard > Authentication > Users
-- 2. Klik "Add user" untuk setiap akun
-- 3. Isi email (pakai format: username@umbk.local) dan password
-- 4. Set metadata: { "username": "...", "nama": "...", "role": "..." }
-- 5. Salin UUID yang dihasilkan dan ganti placeholder di bawah

-- Atau gunakan script di supabase/seed-auth.ts untuk otomatis

-- ── Kelas ────────────────────────────────────────────────────
INSERT INTO kelas (id, nama_kelas, tingkat, tahun_ajaran) VALUES
  ('00000000-0000-0000-0000-000000000001', '9A', 9, '2025/2026'),
  ('00000000-0000-0000-0000-000000000002', '9B', 9, '2025/2026'),
  ('00000000-0000-0000-0000-000000000003', '9C', 9, '2025/2026'),
  ('00000000-0000-0000-0000-000000000004', '9D', 9, '2025/2026'),
  ('00000000-0000-0000-0000-000000000005', '9E', 9, '2025/2026'),
  ('00000000-0000-0000-0000-000000000006', '9F', 9, '2025/2026'),
  ('00000000-0000-0000-0000-000000000007', '9G', 9, '2025/2026');

-- ── CATATAN PENTING ──────────────────────────────────────────
-- Untuk profiles, siswas, gurus:
-- UUID harus sama persis dengan UUID dari auth.users
-- Jalankan seed-auth.ts terlebih dahulu untuk membuat user di Auth
-- kemudian jalankan bagian INSERT profiles/siswas/gurus
-- sesuai UUID yang dihasilkan
