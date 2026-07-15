#!/bin/bash
# ── Deploy ECBT MTS WAHA ke server Ubuntu ────────────────────
# Jalankan: bash deploy.sh
set -e

echo "==> Menyiapkan environment..."
if [ ! -f .env ]; then
  cp .env.example .env
  echo "    File .env dibuat dari .env.example"
  echo "    PENTING: Edit .env sesuai kebutuhan sebelum lanjut!"
  exit 1
fi

echo "==> Membangun dan menjalankan container..."
docker compose down --volumes --remove-orphans
docker compose build --no-cache
docker compose up -d

echo "==> Menunggu GoTrue migrations selesai..."
for i in {1..30}; do
  if docker compose exec -T supabase-db psql -U postgres -d postgres -c "SELECT 1 FROM auth.users LIMIT 1" >/dev/null 2>&1; then
    echo "    Tabel auth.users siap!"
    break
  fi
  echo "    Menunggu auth.users..."
  sleep 2
done

echo "==> Menerapkan schema public..."
docker compose exec -T supabase-db psql -U postgres -d postgres -f /tmp/supabase/schema.sql

echo "==> Melakukan seeding master data..."
docker compose exec -T supabase-db psql -U postgres -d postgres -f /tmp/supabase/seed.sql

echo "==> Melakukan seeding user, profiles, gurus, dan siswas..."
docker compose exec -T supabase-db psql -U postgres -d postgres -f /tmp/supabase/seed-auth.sql

echo "==> Memuat ulang schema cache PostgREST..."
docker compose restart supabase-rest

echo "==> Status container:"
docker compose ps

echo ""
echo "==> ECBT MTS WAHA berhasil dijalankan!"
echo "    App    : http://localhost:3000"
echo "    API    : http://localhost:8000"
echo "    DB     : localhost:5432"
