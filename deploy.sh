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
docker compose down --remove-orphans
docker compose build --no-cache
docker compose up -d

echo "==> Menunggu database siap..."
sleep 10

echo "==> Status container:"
docker compose ps

echo ""
echo "==> ECBT MTS WAHA berhasil dijalankan!"
echo "    App    : http://localhost:3000"
echo "    API    : http://localhost:8000"
echo "    DB     : localhost:5432"
