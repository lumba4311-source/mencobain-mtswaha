-- ============================================================
-- UMBK — MTS WAHA — Seed Auth Users
-- Insert semua user ke auth.users agar bisa login secara lokal
-- tanpa membutuhkan koneksi internet ke Supabase Cloud.
--
-- Password default:
--   admin  : ecbtmtswaha
--   guru   : username@umbk (contoh: 102008@umbk)
--   siswa  : username@umbk (contoh: 240006@umbk)
--
-- Jalankan SETELAH GoTrue sudah running (auth.users sudah ada).
-- Aman dijalankan berulang kali — ON CONFLICT DO UPDATE.
-- ============================================================

-- Disable trigger temporarily to prevent it from crashing on empty metadata during bulk insert
ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created;

INSERT INTO auth.users (
  id, instance_id, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  is_super_admin, role, aud
)
VALUES

-- ── Admin / Proktor ───────────────────────────────────────────
('7b91f539-04b4-4543-ae3f-9a62f108691a','00000000-0000-0000-0000-000000000000',
 'proktor1@umbk.local', crypt('ecbtmtswaha', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

-- ── Guru ─────────────────────────────────────────────────────
('21a81938-0db8-4cc5-9948-79d9a8b81772','00000000-0000-0000-0000-000000000000',
 '102008@umbk.local', crypt('102008@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('b74f1e33-d190-49de-898b-bc026058242f','00000000-0000-0000-0000-000000000000',
 '111009@umbk.local', crypt('111009@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('e6aec4b9-a2dc-446f-9247-b454bef21cda','00000000-0000-0000-0000-000000000000',
 '12003@umbk.local', crypt('12003@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('e262b7f6-6ad6-4943-8fb3-15ba51f4b601','00000000-0000-0000-0000-000000000000',
 '121013@umbk.local', crypt('121013@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('74273fef-6d4f-44f5-a15c-f845e70f5146','00000000-0000-0000-0000-000000000000',
 '122012@umbk.local', crypt('122012@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('34b9970b-5dcc-4043-b435-875ed690ea04','00000000-0000-0000-0000-000000000000',
 '131016@umbk.local', crypt('131016@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('12ee0775-697b-4324-bd31-d99da6c9caff','00000000-0000-0000-0000-000000000000',
 '131017@umbk.local', crypt('131017@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('775eb8d9-94c8-430c-b24f-406e2a5cd898','00000000-0000-0000-0000-000000000000',
 '132014@umbk.local', crypt('132014@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('2619c86e-27d7-4023-af37-42552776667e','00000000-0000-0000-0000-000000000000',
 '132015@umbk.local', crypt('132015@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('112498b5-8fd2-48a4-8add-c49c4238d94f','00000000-0000-0000-0000-000000000000',
 '141020@umbk.local', crypt('141020@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('11b1158b-9be4-49f7-a558-7ef76ff93cee','00000000-0000-0000-0000-000000000000',
 '142018@umbk.local', crypt('142018@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('83400bdf-0311-452b-8c51-c7f5c685f3c8','00000000-0000-0000-0000-000000000000',
 '152026@umbk.local', crypt('152026@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('2823911a-bdd6-4f34-b81f-b83137340559','00000000-0000-0000-0000-000000000000',
 '152027@umbk.local', crypt('152027@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('a52549a1-71d9-4af0-8a8d-8477d9fc1568','00000000-0000-0000-0000-000000000000',
 '161029@umbk.local', crypt('161029@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('49700ebe-f3b5-4ab0-9a85-432d313a8760','00000000-0000-0000-0000-000000000000',
 '161030@umbk.local', crypt('161030@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('626915b9-8a08-4c9d-b454-205fb2cb0779','00000000-0000-0000-0000-000000000000',
 '171036@umbk.local', crypt('171036@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('25436f8e-694e-4e5b-9984-8e9220f702eb','00000000-0000-0000-0000-000000000000',
 '172037@umbk.local', crypt('172037@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('26f01865-1c41-42b6-bb95-9e564b9525a9','00000000-0000-0000-0000-000000000000',
 '181039@umbk.local', crypt('181039@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('deb87cb1-2032-4719-b059-f03ea53ac740','00000000-0000-0000-0000-000000000000',
 '191046@umbk.local', crypt('191046@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('399dfe68-c5e7-475b-8a58-8167ce4ee0cb','00000000-0000-0000-0000-000000000000',
 '192040@umbk.local', crypt('192040@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('fdab0541-7605-4553-acae-6422477c4b6e','00000000-0000-0000-0000-000000000000',
 '192041@umbk.local', crypt('192041@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('b6e2e44f-5280-4638-a236-6c6d8f3a2651','00000000-0000-0000-0000-000000000000',
 '192042@umbk.local', crypt('192042@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('69368ec0-80e5-4447-bda6-def0c4082b31','00000000-0000-0000-0000-000000000000',
 '192043@umbk.local', crypt('192043@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('c21323d6-56e8-453c-ad70-102631f872da','00000000-0000-0000-0000-000000000000',
 '192048@umbk.local', crypt('192048@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('667bac2e-2d54-4084-a695-6b9c1873801e','00000000-0000-0000-0000-000000000000',
 '192049@umbk.local', crypt('192049@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('49821938-6f82-487c-a558-968c17c783cd','00000000-0000-0000-0000-000000000000',
 '202050@umbk.local', crypt('202050@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('6d3d0b39-dc7c-44e2-921a-ea97c40e0799','00000000-0000-0000-0000-000000000000',
 '212052@umbk.local', crypt('212052@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('8afa4533-74e2-4594-9911-b8f835400af6','00000000-0000-0000-0000-000000000000',
 '212053@umbk.local', crypt('212053@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('8bbfb552-8ece-4d00-bdd6-0e5aa0b8aa22','00000000-0000-0000-0000-000000000000',
 '242054@umbk.local', crypt('242054@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('174124fc-3913-4b2a-9e42-d360b0bba677','00000000-0000-0000-0000-000000000000',
 '242055@umbk.local', crypt('242055@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('0e25e3dc-a89e-43d8-8090-91c1810818ae','00000000-0000-0000-0000-000000000000',
 '242056@umbk.local', crypt('242056@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('dcc0614b-6099-40d1-937e-9af09db7fc42','00000000-0000-0000-0000-000000000000',
 '242057@umbk.local', crypt('242057@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('55c03d06-7565-4619-92f3-f244e32edbdb','00000000-0000-0000-0000-000000000000',
 '242068@umbk.local', crypt('242068@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('94680bea-1b93-46c1-99d7-b7d20b67813d','00000000-0000-0000-0000-000000000000',
 '242069@umbk.local', crypt('242069@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('c864a9dc-37a0-4a20-8970-6d68d1022a23','00000000-0000-0000-0000-000000000000',
 '251070@umbk.local', crypt('251070@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

-- ── Siswa ─────────────────────────────────────────────────────
('9648ed14-edbe-4577-8296-9055b4cb8abe','00000000-0000-0000-0000-000000000000',
 '240006@umbk.local', crypt('240006@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('009d1522-26f8-4997-b364-eeaa9e41b905','00000000-0000-0000-0000-000000000000',
 '240011@umbk.local', crypt('240011@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('26852f35-1d4f-431b-a66f-f7e5ea7f8324','00000000-0000-0000-0000-000000000000',
 '240022@umbk.local', crypt('240022@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('4abab077-8f36-45a5-b55e-b03a17570cef','00000000-0000-0000-0000-000000000000',
 '240026@umbk.local', crypt('240026@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('0c19e677-19bb-4a32-a285-9f0264a69068','00000000-0000-0000-0000-000000000000',
 '240027@umbk.local', crypt('240027@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('0127f6bc-681d-47a7-9612-cf16bcc4e2e7','00000000-0000-0000-0000-000000000000',
 '240036@umbk.local', crypt('240036@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('eabdff4d-1414-4fa1-88f2-2aa82fbc14dc','00000000-0000-0000-0000-000000000000',
 '240053@umbk.local', crypt('240053@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('558e03fc-5aa5-4e69-b98a-c3c433e15466','00000000-0000-0000-0000-000000000000',
 '240054@umbk.local', crypt('240054@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('b1785328-e1d2-4c80-9311-62df2822025c','00000000-0000-0000-0000-000000000000',
 '240057@umbk.local', crypt('240057@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('ae3400df-581e-4853-8133-c170fabab165','00000000-0000-0000-0000-000000000000',
 '240059@umbk.local', crypt('240059@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('4823cbc1-128c-4185-8141-e5a4314ad3be','00000000-0000-0000-0000-000000000000',
 '240069@umbk.local', crypt('240069@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('9bbe3a27-0cc1-44e5-94c5-249f9c31be46','00000000-0000-0000-0000-000000000000',
 '240079@umbk.local', crypt('240079@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('78613b2a-0360-4513-a6fd-8537733e3bd1','00000000-0000-0000-0000-000000000000',
 '240095@umbk.local', crypt('240095@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('ff923a8e-29ca-471a-bbf1-81d5f4d07f6c','00000000-0000-0000-0000-000000000000',
 '240104@umbk.local', crypt('240104@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('9cef5f2d-3c29-4b5f-baad-c318afcb151c','00000000-0000-0000-0000-000000000000',
 '240121@umbk.local', crypt('240121@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('10bacc67-494b-48fd-a3dc-d3ced0ece879','00000000-0000-0000-0000-000000000000',
 '240136@umbk.local', crypt('240136@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('6b5e45c8-7675-4c22-b9b1-a2a7b5ad3f5f','00000000-0000-0000-0000-000000000000',
 '240147@umbk.local', crypt('240147@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('569b0c5f-25dd-48bc-bd2a-e5eceb6fd036','00000000-0000-0000-0000-000000000000',
 '240150@umbk.local', crypt('240150@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('ebc6ab89-8ee3-44c2-92f0-6782025b805b','00000000-0000-0000-0000-000000000000',
 '240154@umbk.local', crypt('240154@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('8afa35e2-dd89-4961-a2ec-7e4a458a80bc','00000000-0000-0000-0000-000000000000',
 '240155@umbk.local', crypt('240155@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('a2b9302c-059c-4dd5-bcc8-2bcd3e4e8c52','00000000-0000-0000-0000-000000000000',
 '240157@umbk.local', crypt('240157@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('c803fe8d-8d73-47d7-b68e-3a056dc8ed7b','00000000-0000-0000-0000-000000000000',
 '240168@umbk.local', crypt('240168@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('668a2940-ab30-4dab-b3b9-50b658b43bf6','00000000-0000-0000-0000-000000000000',
 '240177@umbk.local', crypt('240177@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('4e7009aa-d06a-45a3-bb15-bb32f5e03f6a','00000000-0000-0000-0000-000000000000',
 '240184@umbk.local', crypt('240184@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('61b34ff6-e230-4812-995b-589b90c55293','00000000-0000-0000-0000-000000000000',
 '240185@umbk.local', crypt('240185@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('939e4ae4-e98f-4106-bd0d-58b4c4144b84','00000000-0000-0000-0000-000000000000',
 '240186@umbk.local', crypt('240186@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('dd597ffa-e0f8-412f-afe7-d0e434ac8db2','00000000-0000-0000-0000-000000000000',
 '240195@umbk.local', crypt('240195@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated'),

('0008a3a7-16c6-4dfb-ae5c-1c0c2f6d2a8b','00000000-0000-0000-0000-000000000000',
 '240198@umbk.local', crypt('240198@umbk', gen_salt('bf')),
 NOW(), NOW(), NOW(),
 '{"provider":"email","providers":["email"]}','{}', FALSE,'authenticated','authenticated')

ON CONFLICT (id) DO UPDATE SET
  email              = EXCLUDED.email,
  encrypted_password = EXCLUDED.encrypted_password,
  updated_at         = NOW();

-- Re-enable trigger
ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created;

-- ── Seed Profiles dari auth.users ────────────────────────────────
INSERT INTO public.profiles (id, username, nama, role, status, password)
SELECT
  id,
  split_part(email, '@', 1) AS username,
  CASE
    WHEN email = 'proktor1@umbk.local' THEN 'Proktor Utama'
    WHEN email LIKE '240%' THEN 'Siswa ' || split_part(email, '@', 1)
    ELSE 'Guru ' || split_part(email, '@', 1)
  END AS nama,
  CASE
    WHEN email = 'proktor1@umbk.local' THEN 'proktor'::role_enum
    WHEN email LIKE '240%' THEN 'siswa'::role_enum
    ELSE 'guru'::role_enum
  END AS role,
  'aktif'::status_akun_enum AS status,
  CASE
    WHEN email = 'proktor1@umbk.local' THEN 'ecbtmtswaha'
    ELSE split_part(email, '@', 1) || '@umbk'
  END AS password
FROM auth.users
WHERE email LIKE '%@umbk.local'
ON CONFLICT (id) DO UPDATE SET
  username = EXCLUDED.username,
  nama = EXCLUDED.nama,
  role = EXCLUDED.role,
  password = EXCLUDED.password;

-- ── Seed Gurus dari Profiles ─────────────────────────────────────
INSERT INTO public.gurus (nip, nama, id_user)
SELECT
  username AS nip,
  nama,
  id AS id_user
FROM public.profiles
WHERE role = 'guru'
ON CONFLICT (nip) DO NOTHING;

-- ── Seed Siswas dari Profiles ─────────────────────────────────────
INSERT INTO public.siswas (nis, nama, id_kelas, id_user)
SELECT
  username AS nis,
  nama,
  CASE (row_number() OVER (ORDER BY username) % 7)
    WHEN 0 THEN '00000000-0000-0000-0000-000000000001'::uuid
    WHEN 1 THEN '00000000-0000-0000-0000-000000000002'::uuid
    WHEN 2 THEN '00000000-0000-0000-0000-000000000003'::uuid
    WHEN 3 THEN '00000000-0000-0000-0000-000000000004'::uuid
    WHEN 4 THEN '00000000-0000-0000-0000-000000000005'::uuid
    WHEN 5 THEN '00000000-0000-0000-0000-000000000006'::uuid
    ELSE '00000000-0000-0000-0000-000000000007'::uuid
  END AS id_kelas,
  id AS id_user
FROM public.profiles
WHERE role = 'siswa'
ON CONFLICT (nis) DO NOTHING;

-- Fix GoTrue scanner NULL-to-string scan errors by ensuring token columns are empty strings instead of NULL
UPDATE auth.users
SET
  confirmation_token = COALESCE(confirmation_token, ''),
  recovery_token = COALESCE(recovery_token, ''),
  email_change = COALESCE(email_change, ''),
  email_change_token_new = COALESCE(email_change_token_new, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change_token = COALESCE(phone_change_token, '');
