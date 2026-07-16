-- ============================================================
-- UMBK — MTS WAHA — Seed Data (Docker PostgreSQL)
-- Password di-hash dengan bcrypt (cost 10)
--
-- Password default:
--   proktor1  : ecbtmtswaha
--   guru      : username@umbk  (contoh: 102008@umbk)
--   siswa     : username@umbk  (contoh: 240006@umbk)
--
-- Hash dibuat dengan: SELECT crypt('password', gen_salt('bf', 10));
-- ============================================================

-- ── Kelas ────────────────────────────────────────────────────
INSERT INTO kelas (id, nama_kelas, tingkat, tahun_ajaran) VALUES
  -- Kelas 7
  ('00000000-0000-0000-0000-000000000101', '7A',       7, '2025/2026'),
  ('00000000-0000-0000-0000-000000000102', '7B',       7, '2025/2026'),
  ('00000000-0000-0000-0000-000000000103', '7C',       7, '2025/2026'),
  ('00000000-0000-0000-0000-000000000104', '7D',       7, '2025/2026'),
  ('00000000-0000-0000-0000-000000000105', '7E',       7, '2025/2026'),
  ('00000000-0000-0000-0000-000000000106', '7Unknown', 7, '2025/2026'),
  -- Kelas 8
  ('00000000-0000-0000-0000-000000000201', '8A',       8, '2025/2026'),
  ('00000000-0000-0000-0000-000000000202', '8B',       8, '2025/2026'),
  ('00000000-0000-0000-0000-000000000203', '8C',       8, '2025/2026'),
  ('00000000-0000-0000-0000-000000000204', '8D',       8, '2025/2026'),
  ('00000000-0000-0000-0000-000000000205', '8E',       8, '2025/2026'),
  ('00000000-0000-0000-0000-000000000206', '8F',       8, '2025/2026'),
  ('00000000-0000-0000-0000-000000000207', '8G',       8, '2025/2026'),
  -- Kelas 9
  ('00000000-0000-0000-0000-000000000001', '9A',       9, '2025/2026'),
  ('00000000-0000-0000-0000-000000000002', '9B',       9, '2025/2026'),
  ('00000000-0000-0000-0000-000000000003', '9C',       9, '2025/2026'),
  ('00000000-0000-0000-0000-000000000004', '9D',       9, '2025/2026'),
  ('00000000-0000-0000-0000-000000000005', '9E',       9, '2025/2026'),
  ('00000000-0000-0000-0000-000000000006', '9F',       9, '2025/2026'),
  ('00000000-0000-0000-0000-000000000007', '9G',       9, '2025/2026')
ON CONFLICT (id) DO NOTHING;

-- ── Profiles: Admin / Proktor ─────────────────────────────────
INSERT INTO profiles (id, username, password, nama, role, status) VALUES
  ('7b91f539-04b4-4543-ae3f-9a62f108691a',
   'proktor1',
   crypt('ecbtmtswaha', gen_salt('bf', 10)),
   'Proktor 1', 'proktor', 'aktif')
ON CONFLICT (id) DO UPDATE SET
  password   = EXCLUDED.password,
  nama       = EXCLUDED.nama;

-- ── Profiles: Guru ───────────────────────────────────────────
INSERT INTO profiles (id, username, password, nama, role, status) VALUES
  ('21a81938-0db8-4cc5-9948-79d9a8b81772',
   '102008',
   crypt('102008@umbk', gen_salt('bf', 10)),
   'Guru 102008', 'guru', 'aktif'),
  ('b74f1e33-d190-49de-898b-bc026058242f',
   '111009',
   crypt('111009@umbk', gen_salt('bf', 10)),
   'Guru 111009', 'guru', 'aktif'),
  ('e6aec4b9-a2dc-446f-9247-b454bef21cda',
   '12003',
   crypt('12003@umbk', gen_salt('bf', 10)),
   'Guru 12003', 'guru', 'aktif')
ON CONFLICT (id) DO UPDATE SET
  password = EXCLUDED.password,
  nama     = EXCLUDED.nama;

-- ── Gurus ────────────────────────────────────────────────────
INSERT INTO gurus (nip, nama, id_user) VALUES
  ('102008', 'Guru 102008', '21a81938-0db8-4cc5-9948-79d9a8b81772'),
  ('111009', 'Guru 111009', 'b74f1e33-d190-49de-898b-bc026058242f'),
  ('12003',  'Guru 12003',  'e6aec4b9-a2dc-446f-9247-b454bef21cda')
ON CONFLICT (nip) DO NOTHING;

-- ── Profiles: Siswa (sample) ─────────────────────────────────
INSERT INTO profiles (id, username, password, nama, role, status) VALUES
  ('a1000001-0000-0000-0000-000000000001',
   '240006',
   crypt('240006@umbk', gen_salt('bf', 10)),
   'Siswa 240006', 'siswa', 'aktif'),
  ('a1000001-0000-0000-0000-000000000002',
   '240007',
   crypt('240007@umbk', gen_salt('bf', 10)),
   'Siswa 240007', 'siswa', 'aktif'),
  ('a1000001-0000-0000-0000-000000000003',
   '240008',
   crypt('240008@umbk', gen_salt('bf', 10)),
   'Siswa 240008', 'siswa', 'aktif')
ON CONFLICT (id) DO UPDATE SET
  password = EXCLUDED.password,
  nama     = EXCLUDED.nama;

-- ── Siswas ───────────────────────────────────────────────────
INSERT INTO siswas (nis, nama, id_kelas, id_user) VALUES
  ('240006', 'Siswa 240006', '00000000-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000001'),
  ('240007', 'Siswa 240007', '00000000-0000-0000-0000-000000000001', 'a1000001-0000-0000-0000-000000000002'),
  ('240008', 'Siswa 240008', '00000000-0000-0000-0000-000000000002', 'a1000001-0000-0000-0000-000000000003')
ON CONFLICT (nis) DO NOTHING;
