-- ============================================================
-- Init PostgreSQL untuk Supabase local stack
-- GoTrue akan membuat semua tabel auth.* sendiri via migrations
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ── Schemas ──────────────────────────────────────────────────
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS extensions;

-- ── Roles ────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN NOINHERIT;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticator') THEN
    CREATE ROLE authenticator NOINHERIT LOGIN PASSWORD 'rDwlpThx2Q5JDyLhaYD8sVzmh4Y3on';
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_auth_admin') THEN
    CREATE ROLE supabase_auth_admin NOINHERIT LOGIN PASSWORD 'rDwlpThx2Q5JDyLhaYD8sVzmh4Y3on' CREATEROLE;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'supabase_admin') THEN
    CREATE ROLE supabase_admin NOINHERIT LOGIN PASSWORD 'rDwlpThx2Q5JDyLhaYD8sVzmh4Y3on' CREATEROLE CREATEDB;
  END IF;
END
$$;

-- ── Grant roles ───────────────────────────────────────────────
GRANT anon TO authenticator;
GRANT authenticated TO authenticator;
GRANT service_role TO authenticator;
GRANT supabase_admin TO postgres;

-- ── Set auth schema owner ke supabase_auth_admin ─────────────
-- GoTrue butuh ownership penuh agar bisa buat semua tabelnya
ALTER SCHEMA auth OWNER TO supabase_auth_admin;

-- ── Grant schema public ───────────────────────────────────────
GRANT ALL ON SCHEMA public TO postgres, supabase_admin, supabase_auth_admin, authenticator, anon, authenticated, service_role;

-- ── Set search_path untuk roles ──────────────────────────────
ALTER ROLE supabase_auth_admin SET search_path = auth, public;
ALTER ROLE authenticator SET search_path = auth, public;
ALTER DATABASE postgres SET search_path = auth, public;

-- ── Default privileges di public schema ──────────────────────
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
