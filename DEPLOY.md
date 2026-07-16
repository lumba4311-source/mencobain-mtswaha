# Panduan Deploy ke Server

Server: `ubuntu@10.72.66.20`  
Akses: SSH password `ubuntu`  
App URL: `http://10.72.66.20:3000`

## Info Server

| Item | Value |
|------|-------|
| Network Docker | `ecbt_mtswaha_ecbt_network` |
| Container App | `ecbt_app` |
| Container DB | `ecbt_db` |
| DB Name | `ecbt` |
| DB User | `postgres` |
| DB Password | `rDwlpThx2Q5JDyLhaYD8sVzmh4Y3on` |
| Port App | `3000` |

---

## Update Code ke Server

### 1. Sync source code
```bash
sshpass -p 'ubuntu' rsync -avz \
  --exclude='node_modules' \
  --exclude='.next' \
  --exclude='uploads' \
  --exclude='.git' \
  /home/dwikyoman/Documents/ecbtmtswaha/mencobain-mtswaha/ \
  ubuntu@10.72.66.20:~/mencobain-mtswaha/
```

### 2. Build Docker image di server
```bash
sshpass -p 'ubuntu' ssh ubuntu@10.72.66.20 \
  "cd ~/mencobain-mtswaha && docker build -t ecbt_app . 2>&1 | tail -10"
```

### 3. Restart container
```bash
sshpass -p 'ubuntu' ssh ubuntu@10.72.66.20 "
  docker stop ecbt_app && docker rm ecbt_app &&
  docker run -d --name ecbt_app \
    --network ecbt_mtswaha_ecbt_network \
    -p 3000:3000 \
    -e DATABASE_URL=postgres://postgres:rDwlpThx2Q5JDyLhaYD8sVzmh4Y3on@ecbt_db:5432/ecbt \
    -e JWT_SECRET=changeme-jwt-secret-min-32-chars!! \
    -e COOKIE_SECURE=false \
    -v ecbt_uploads:/app/uploads \
    ecbt_app
"
```

### 4. Verifikasi
```bash
sshpass -p 'ubuntu' ssh ubuntu@10.72.66.20 "docker logs ecbt_app --tail 10"
```

---

## Migrate Data DB (Lokal → Server)

Lakukan ini kalau ada perubahan data/seed di DB lokal yang perlu dipindah ke server.

> **Peringatan:** Data di server akan di-replace total.

### 1. Dump DB lokal
```bash
docker exec ecbt_db pg_dump -U postgres --clean --if-exists ecbt > /tmp/ecbt_dump.sql
```

### 2. Kirim ke server
```bash
sshpass -p 'ubuntu' scp /tmp/ecbt_dump.sql ubuntu@10.72.66.20:/tmp/ecbt_dump.sql
```

### 3. Restore di server
```bash
sshpass -p 'ubuntu' ssh ubuntu@10.72.66.20 \
  "docker exec -i ecbt_db psql -U postgres -d ecbt < /tmp/ecbt_dump.sql"
```

### 4. Verifikasi
```bash
sshpass -p 'ubuntu' ssh ubuntu@10.72.66.20 \
  "docker exec ecbt_db psql -U postgres -d ecbt -c 'SELECT nama_ujian FROM ujians;'"
```

---

## Update Code + Migrate DB Sekaligus

Jalankan semua langkah di atas secara berurutan:

```bash
# 1. Sync code
sshpass -p 'ubuntu' rsync -avz \
  --exclude='node_modules' --exclude='.next' --exclude='uploads' --exclude='.git' \
  /home/dwikyoman/Documents/ecbtmtswaha/mencobain-mtswaha/ \
  ubuntu@10.72.66.20:~/mencobain-mtswaha/

# 2. Build di server
sshpass -p 'ubuntu' ssh ubuntu@10.72.66.20 \
  "cd ~/mencobain-mtswaha && docker build -t ecbt_app . 2>&1 | tail -5"

# 3. Restart container
sshpass -p 'ubuntu' ssh ubuntu@10.72.66.20 "
  docker stop ecbt_app && docker rm ecbt_app &&
  docker run -d --name ecbt_app \
    --network ecbt_mtswaha_ecbt_network \
    -p 3000:3000 \
    -e DATABASE_URL=postgres://postgres:rDwlpThx2Q5JDyLhaYD8sVzmh4Y3on@ecbt_db:5432/ecbt \
    -e JWT_SECRET=changeme-jwt-secret-min-32-chars!! \
    -e COOKIE_SECURE=false \
    -v ecbt_uploads:/app/uploads \
    ecbt_app
"

# 4. Dump & migrate DB
docker exec ecbt_db pg_dump -U postgres --clean --if-exists ecbt > /tmp/ecbt_dump.sql
sshpass -p 'ubuntu' scp /tmp/ecbt_dump.sql ubuntu@10.72.66.20:/tmp/ecbt_dump.sql
sshpass -p 'ubuntu' ssh ubuntu@10.72.66.20 \
  "docker exec -i ecbt_db psql -U postgres -d ecbt < /tmp/ecbt_dump.sql"
```

---

## Troubleshooting

### Login gagal 500
Cek logs container:
```bash
sshpass -p 'ubuntu' ssh ubuntu@10.72.66.20 "docker logs ecbt_app --tail 20"
```

| Error | Penyebab | Fix |
|-------|----------|-----|
| `getaddrinfo EAI_AGAIN db` | Hostname DB salah | Ganti `db` → `ecbt_db` di `DATABASE_URL` |
| `password authentication failed` | Password DB salah | Cek password via `docker inspect ecbt_db` |
| `network not found` | Nama network salah | Cek via `docker network ls` di server |

### Cek network & container di server
```bash
sshpass -p 'ubuntu' ssh ubuntu@10.72.66.20 "docker network ls && docker ps"
```

### Cek password DB di server
```bash
sshpass -p 'ubuntu' ssh ubuntu@10.72.66.20 \
  "docker inspect ecbt_db | grep POSTGRES_PASSWORD"
```
