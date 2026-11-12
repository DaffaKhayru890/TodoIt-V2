# Deployment — Environment Strategy

## 1. Prinsip

1. **Twelve-factor**: konfigurasi dari environment, bukan hardcode.
2. **Satu binary, banyak environment.** Tidak ada build khusus per environment.
3. **Fail fast**: config tidak valid → aplikasi berhenti dengan pesan jelas.
4. **Secret tidak masuk image/repository.**
5. **Development mirip production** (PostgreSQL, Go version), tetapi credential berbeda.
6. **Least privilege**: user DB runtime tidak memiliki hak DDL.

## 2. Environment

| Environment | Tujuan | Data | Akses |
|---|---|---|---|
| `development` | Coding lokal | Dummy/seed | Developer |
| `test` | CI & integration test | Ephemeral | CI runner |
| `staging` | Pre-production, UAT | Mirip production (anonim) | Tim internal |
| `production` | Melayani user | Nyata | Terbatas |

`APP_ENV` menentukan:

- Default log level.
- Apakah Swagger aktif.
- Apakah worker aktif.
- Validasi tambahan (mis. menolak `DB_SSLMODE=disable` di production).
- Format log (JSON di staging/production).

## 3. Matriks Konfigurasi

| Variabel | development | test | staging | production |
|---|---|---|---|---|
| `APP_ENV` | `development` | `test` | `staging` | `production` |
| `APP_PORT` | `8080` | `8081` | `8080` | `8080` |
| `LOG_LEVEL` | `debug` | `warn` | `info` | `info` |
| `LOG_FORMAT` | `text` | `text` | `json` | `json` |
| `DB_HOST` | `postgres` | `localhost`/service | secret | secret |
| `DB_PORT` | `5432` | `5432` | `5432` | `5432` |
| `DB_USER` | `root` | `root` | secret | secret |
| `DB_PASSWORD` | `dev@123` | `dev@123` | secret | secret |
| `DB_NAME` | `todolist` | `todolist_test` | `todolist_staging` | `todolist` |
| `DB_SSLMODE` | `disable` | `disable` | `require` | `verify-full` |
| `DB_MAX_OPEN_CONNS` | `25` | `10` | `25` | `25` |
| `JWT_SECRET` | dev secret | test secret | secret manager | secret manager |
| `CURSOR_SECRET` | dev secret | test secret | secret manager | secret manager |
| `ACCESS_TOKEN_TTL` | `15m` | `15m` | `15m` | `15m` |
| `REFRESH_TOKEN_TTL` | `720h` | `720h` | `720h` | `720h` |
| `BCRYPT_COST` | `12` | `4` (cepat) | `12` | `12` |
| `WORKER_ENABLED` | `true` | `false`* | `true` (1 instance) | `true` (1 instance) |
| `SWAGGER_ENABLED` | `true` | `false` | `false` | `false` |
| `SMTP_HOST` | kosong (logger) | kosong | SMTP staging | SMTP production |
| `NOTIFICATION_EMAIL_ENABLED` | `false` | `false` | `false` | `true` (opsional) |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173,...` | — | domain staging | domain production |

\* Test integrasi worker menyalakan worker secara eksplisit per test, bukan lewat env global.

`BCRYPT_COST=4` hanya untuk test karena kecepatan; **dilarang** di staging/production.

## 4. Variabel Lengkap

### 4.1 Aplikasi

| Variabel | Wajib | Default | Validasi |
|---|---|---|---|
| `APP_ENV` | Ya | — | `development`/`test`/`staging`/`production` |
| `APP_PORT` | Tidak | `8080` | 1–65535 |
| `LOG_LEVEL` | Tidak | `info` | `debug`/`info`/`warn`/`error` |
| `LOG_FORMAT` | Tidak | `json` | `json`/`text` |
| `MAX_BODY_BYTES` | Tidak | `1048576` | > 0 |
| `TRUSTED_PROXIES` | Tidak | kosong | CIDR/IP, comma-separated |
| `CORS_ALLOWED_ORIGINS` | Ya (prod) | — | origin valid, bukan `*` di prod |
| `SWAGGER_ENABLED` | Tidak | `false` | bool |

### 4.2 Database

| Variabel | Wajib | Default | Validasi |
|---|---|---|---|
| `DB_HOST` | Ya | — | non-empty |
| `DB_PORT` | Tidak | `5432` | 1–65535 |
| `DB_USER` | Ya | — | non-empty |
| `DB_PASSWORD` | Ya | — | non-empty |
| `DB_NAME` | Ya | — | non-empty, `_test` untuk test |
| `DB_SSLMODE` | Tidak | `disable` | `disable`/`require`/`verify-ca`/`verify-full` |
| `DB_MAX_OPEN_CONNS` | Tidak | `25` | 1–200 |
| `DB_MAX_IDLE_CONNS` | Tidak | `10` | 0–`MaxOpen` |
| `DB_CONN_MAX_LIFETIME` | Tidak | `30m` | > 0 |

Aturan tambahan:

- Production wajib `DB_SSLMODE=require` atau lebih ketat. Aplikasi menolak start jika
  `APP_ENV=production` dan `disable`.
- `DB_MAX_IDLE_CONNS <= DB_MAX_OPEN_CONNS`.
- Test menolak `DB_NAME` yang tidak berakhiran `_test`.

### 4.3 Authentication

| Variabel | Wajib | Default | Validasi |
|---|---|---|---|
| `JWT_SECRET` | Ya | — | ≥ 32 byte, bukan placeholder di prod |
| `JWT_ISSUER` | Tidak | `todoit-api` | non-empty |
| `JWT_AUDIENCE` | Tidak | `todoit-client` | non-empty |
| `ACCESS_TOKEN_TTL` | Tidak | `15m` | 1m–1h |
| `REFRESH_TOKEN_TTL` | Tidak | `720h` | 1h–2160h |
| `BCRYPT_COST` | Tidak | `12` | 10–14 (test: 4) |
| `LOGIN_RATE_LIMIT` | Tidak | `5` | 1–100 |
| `LOGIN_RATE_WINDOW` | Tidak | `1m` | 1s–1h |
| `REFRESH_RATE_LIMIT` | Tidak | `30` | 1–300 |

`JWT_SECRET` dan `CURSOR_SECRET` harus berbeda. Aplikasi menolak start jika sama.

### 4.4 Cursor

| Variabel | Wajib | Default | Validasi |
|---|---|---|---|
| `CURSOR_SECRET` | Ya | — | ≥ 32 byte |

### 4.5 Workspace & Invitation

| Variabel | Wajib | Default | Validasi |
|---|---|---|---|
| `INVITATION_TTL` | Tidak | `168h` | 1h–720h |
| `DEFAULT_TIMEZONE` | Tidak | `UTC` | IANA |
| `UPCOMING_DAYS` | Tidak | `7` | 1–30 |

### 4.6 Worker

| Variabel | Wajib | Default | Validasi |
|---|---|---|---|
| `WORKER_ENABLED` | Tidak | `true` (dev) | bool |
| `WORKER_INTERVAL` | Tidak | `30s` | 5s–1h |
| `WORKER_BATCH_SIZE` | Tidak | `50` | 1–500 |
| `WORKER_BATCH_TIMEOUT` | Tidak | `25s` | 5s–5m |
| `WORKER_MAX_ATTEMPTS` | Tidak | `5` | 1–20 |
| `WORKER_STALE_LOCK` | Tidak | `5m` | 1m–1h |
| `WORKER_SCAN_INTERVAL` | Tidak | `10m` | 1m–24h |
| `WORKER_SHUTDOWN_TIMEOUT` | Tidak | `20s` | 1s–2m |

### 4.7 HTTP

| Variabel | Wajib | Default |
|---|---|---|
| `HTTP_SHUTDOWN_TIMEOUT` | Tidak | `15s` |
| `SERVER_READ_TIMEOUT` | Tidak | `10s` |
| `SERVER_WRITE_TIMEOUT` | Tidak | `30s` |
| `SERVER_IDLE_TIMEOUT` | Tidak | `60s` |

### 4.8 Mail

| Variabel | Wajib | Default | Validasi |
|---|---|---|---|
| `SMTP_HOST` | Tidak | kosong | non-empty = SMTP aktif |
| `SMTP_PORT` | Tidak | `587` | 1–65535 |
| `SMTP_USERNAME` | Tidak | kosong | |
| `SMTP_PASSWORD` | Tidak | kosong | |
| `SMTP_FROM` | Tidak | `no-reply@todoit.local` | email |
| `SMTP_TLS` | Tidak | `true` | bool |
| `NOTIFICATION_EMAIL_ENABLED` | Tidak | `false` | bool |

Jika `SMTP_HOST` kosong → gunakan `LoggerMailer` (development). Jika diisi tetapi kredensial
tidak lengkap → gagal start (kecuali `SMTP_USERNAME`/`PASSWORD` memang opsional untuk relay
lokal).

## 5. File Environment

| File | Commit? | Isi |
|---|---|---|
| `.env.example` | Ya | Semua variabel dengan placeholder aman |
| `.env.development` | Tidak | Kredensial dev lokal |
| `.env.test` | Tidak | Kredensial test lokal/CI |
| `.env.staging.example` | Ya | Placeholder staging |
| `.env.production.example` | Ya | Placeholder production |
| `.env` | Tidak | Override lokal, tidak dipakai di container |
| `.env.*.local` | Tidak | Override pribadi |

`.gitignore` wajib memuat:

```gitignore
.env
.env.development
.env.test
.env.*.local
!.env.example
!.env.staging.example
!.env.production.example
```

Alasan `.env.example` dan file `*.example` di-commit: dokumentasi konfigurasi tanpa secret.
`.env.development` tidak di-commit meskipun hanya berisi kredensial dev, untuk menghindari
kebiasaan menyimpan env nyata di git dan risiko file dev dipakai di server.

Cara mendapatkan file dev:

```bash
cp .env.example .env.development
# isi nilai dev (lihat README)
```

## 6. Precedence

Urutan prioritas (tinggi → rendah):

1. Environment variable proses (dari orchestrator/secret manager).
2. `env_file` Compose (disuntikkan sebagai env proses).
3. File `.env` yang dimuat aplikasi **hanya jika** `ENV_FILE` di-set.
4. Default di kode.

Keputusan: aplikasi **tidak** otomatis memuat `.env` di production. Container memakai env
proses. Untuk development, `ENV_FILE=.env.development` dapat di-set, atau Compose memakai
`env_file` (lebih sederhana). Ini mencegah file `.env` yang tidak sengaja ada di image
mengubah konfigurasi.

## 7. Validasi Startup

Config di-load sekali di `main` sebelum koneksi DB:

```text
1. Baca env
2. Trim spasi
3. Parse tipe (int, duration, bool, CSV)
4. Validasi range/enum
5. Validasi kombinasi:
   - production: SSLMODE != disable
   - JWT_SECRET != CURSOR_SECRET
   - secret length >= 32
   - DB_MAX_IDLE <= DB_MAX_OPEN
   - SMTP lengkap jika host diisi
6. Jika gagal: log daftar variabel yang salah (tanpa nilai) dan exit 1
```

Contoh log:

```json
{"level":"ERROR","msg":"invalid configuration","fields":["DB_PORT","JWT_SECRET"]}
```

Tidak pernah menampilkan nilai secret di log/error.

## 8. Secret Management

### 8.1 Prinsip

- Secret tidak disimpan di git, image, atau dokumentasi.
- Secret disuntikkan saat runtime.
- Setiap environment memiliki secret berbeda.
- Akses secret diaudit.
- Rotasi berkala dan saat ada indikasi kebocoran.

### 8.2 Opsi

| Platform | Mekanisme |
|---|---|
| Docker Compose | `env_file` dari file di host (bukan image) atau `docker secret` (Swarm) |
| Kubernetes | `Secret` + `envFrom` / volume; external-secrets operator |
| AWS | Secrets Manager → task definition env / CSI driver |
| GCP | Secret Manager → Cloud Run env / CSI |
| Vault | Agent inject / env template |

### 8.3 Secret yang Wajib

| Secret | Rotasi |
|---|---|
| `DB_PASSWORD` | 90 hari / insiden |
| `JWT_SECRET` | 90 hari; rotasi menyebabkan access token lama invalid |
| `CURSOR_SECRET` | 30–90 hari; cursor lama invalid |
| `SMTP_PASSWORD` | 90 hari |
| `INVITATION` token | Tidak disimpan (hash), tidak perlu rotasi secret |

### 8.4 Rotasi Tanpa Downtime

- **DB password**: buat user/password baru, deploy config baru, hapus yang lama setelah
  semua instance memakai yang baru.
- **JWT secret**: dukung dua secret (current + previous) selama masa transisi; verifier
  mencoba current lalu previous. Implementasi Phase 2/9. Tanpa dukungan ini, rotasi
  menyebabkan semua user logout (dapat diterima jika diumumkan).
- **Cursor secret**: rotasi menyebabkan cursor invalid; client reset. Lakukan bersamaan
  dengan deploy.
- **SMTP**: dapat dirotasi tanpa dampak user.

## 9. Perbedaan Environment yang Penting

| Aspek | Dev | Prod | Alasan |
|---|---|---|---|
| Swagger | Aktif | Nonaktif | Mengurangi surface |
| Log format | Text | JSON | Mudah dibaca vs mesin |
| SSL DB | Disable | Verify-full | Keamanan |
| Bcrypt cost | 12 | 12 | Konsisten (test 4) |
| Worker | Aktif | Satu instance | Kontrol beban |
| CORS | Localhost | Domain spesifik | Keamanan |
| Seed | Ya | Tidak | Data |
| Rate limit | Longgar | Ketat | Perlindungan |
| Email | Logger | SMTP | Realitas |
| Migration | Manual/dev | Job | Kontrol |

## 10. Konfigurasi per Komponen

### 10.1 API

- Membaca semua env.
- Gagal start jika DB tidak dapat di-ping (dengan retry singkat 5×2s saat start).
- Worker mengikuti `WORKER_ENABLED`.

### 10.2 Worker-only instance

- `WORKER_ENABLED=true`
- Port tetap terbuka untuk health (tidak diekspos ke publik).
- Tidak perlu CORS/Swagger.

### 10.3 Migration job

- Hanya butuh `DB_*` dan `DATABASE_URL`.
- Tidak butuh `JWT_SECRET`.
- Menggunakan user DB dengan hak DDL.

## 11. Database Credential

### 11.1 Development

```env
DB_HOST=postgres
DB_PORT=5432
DB_USER=root
DB_PASSWORD=dev@123
DB_NAME=todolist
DB_SSLMODE=disable
```

Hanya untuk lokal. Tidak boleh dipakai di staging/production.

### 11.2 Test

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=root
DB_PASSWORD=dev@123
DB_NAME=todolist_test
DB_SSLMODE=disable
```

Atau `TEST_DATABASE_URL` untuk integration test. Helper menolak database tanpa suffix
`_test`.

### 11.3 Staging/Production

- User terpisah untuk runtime dan migration.
- Runtime: `SELECT, INSERT, UPDATE, DELETE` pada tabel aplikasi; tanpa `CREATE`.
- Migration: `CREATE, ALTER, DROP, INDEX`.
- Password dari secret manager.
- SSL wajib.
- Akses jaringan dibatasi (VPC/private subnet).

Contoh pembuatan user (ilustrasi, Phase 9):

```sql
CREATE ROLE todoit_app LOGIN PASSWORD '...';
GRANT CONNECT ON DATABASE todolist TO todoit_app;
GRANT USAGE ON SCHEMA public TO todoit_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO todoit_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO todoit_app;
```

## 12. Konfigurasi yang Tidak Boleh Berubah Saat Runtime

Perubahan berikut memerlukan restart:

- `APP_PORT`, `DB_*`, `JWT_*`, `CURSOR_SECRET`, `WORKER_*`, `SMTP_*`, `CORS_*`.

Tidak ada reload config otomatis. Alasan: menghindari state tidak konsisten dan race.
Perubahan dilakukan lewat deploy rolling.

## 13. Troubleshooting Config

| Gejala | Penyebab | Solusi |
|---|---|---|
| `invalid configuration` | Env wajib kosong | Isi sesuai `.env.example` |
| `JWT_SECRET too short` | < 32 byte | Gunakan secret lebih panjang |
| `JWT_SECRET and CURSOR_SECRET must differ` | Sama | Pisahkan |
| `production requires DB_SSLMODE` | `disable` | Set `require`/`verify-full` |
| `invalid timezone` | IANA salah | Gunakan `Asia/Jakarta` |
| `SMTP configuration incomplete` | Host diisi, kredensial kosong | Lengkapi atau kosongkan host |
| API tidak membaca `.env` | `ENV_FILE` tidak di-set | Set atau gunakan `env_file` Compose |

## 14. Checklist

- [ ] Semua env terdokumentasi di `.env.example`.
- [ ] Validasi startup lengkap.
- [ ] Secret tidak di git/image.
- [ ] Production menolak SSL disable.
- [ ] `JWT_SECRET` ≠ `CURSOR_SECRET`.
- [ ] Test DB terpisah dan divalidasi.
- [ ] Worker dapat dimatikan per instance.
- [ ] Swagger mati di production.
- [ ] CORS allowlist.
- [ ] Dokumentasi rotasi secret.
- [ ] Tidak ada default secret di kode.

## 15. Keputusan dan Trade-off

| Keputusan | Alasan | Alternatif |
|---|---|---|
| Env + secret manager | Standar 12-factor | File config di image (tidak aman) |
| `.env.development` tidak di-commit | Menghindari kebiasaan buruk | Commit (risiko) |
| Fail fast | Mencegah error terlambat | Default diam-diam (berbahaya) |
| Secret terpisah per env | Isolasi | Satu secret semua env (berisiko) |
| Tanpa hot reload config | Konsistensi | Reload (kompleks) |
| Dua secret JWT untuk rotasi | Zero-downtime | Rotasi langsung (logout massal) |
| Runtime user tanpa DDL | Least privilege | Satu user super (berisiko) |
