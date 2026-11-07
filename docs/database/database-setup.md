# Setup Database

Dokumen ini menjelaskan arsitektur akses database PostgreSQL, konfigurasi koneksi Drizzle, dan alur migration pada Phase 1.

## 1. Posisi database dalam arsitektur

PostgreSQL hanya boleh disentuh oleh infrastructure layer:

```text
Presentation  →  Application (port)  →  Infrastructure (implementasi port)  →  PostgreSQL
```

- Port `DatabaseProbe` ([src/modules/health/application/ports/database-probe.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/modules/health/application/ports/database-probe.ts)) adalah satu-satunya yang dilihat use case; bentuknya hanya `probe(): Promise<void>`.
- Implementasinya `createDatabaseProbe(client)` ([src/modules/health/infrastructure/database-probe.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/modules/health/infrastructure/database-probe.ts)) meneruskan panggilan ke `client.ping()`.
- Koneksi fisik dibuat `createDatabaseClient(config, logger)` ([src/shared/infrastructure/database/client.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/shared/infrastructure/database/client.ts)).
- Tidak ada query Drizzle di presentation maupun application. Interface repository berada di layer dalam, implementasinya di infrastructure — arah dependency tetap ke dalam.

## 2. Connection pool

Satu pool dibuat sekali di composition root ([src/bootstrap/container.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/bootstrap/container.ts)) dan dipakai sepanjang umur proses; request berikutnya mengambil koneksi dari pool yang sama, tidak membuat koneksi baru.

| Parameter | Nilai | Efek |
| --- | --- | --- |
| `max` | 10 (`POOL_MAX_CONNECTIONS`) | batas koneksi simultan |
| `idleTimeoutMillis` | 30 000 | koneksi idle ditutup setelah 30 detik |
| `connectionTimeoutMillis` | 5 000 | permintaan koneksi gagal cepat bila pool habis |
| `ssl` | `{ rejectUnauthorized: true }` saat `DATABASE_SSL=true`, selain itu `undefined` | verifikasi sertifikat untuk staging/production |
| host/port/user/password/database | dari `AppConfig.database` | tidak ada kredensial hardcoded di kode |

Dua keputusan teknis yang perlu dicatat:

- **Handler `pool.on('error')`.** Driver `pg` memancarkan error pada objek pool bila koneksi idle terputus. Tanpa handler, kejadian itu menghentikan proses padahal request berikutnya masih bisa dilayani. Sekarang error dicatat sebagai log (`idle database client error`) tanpa mengungkap isi error.
- **`close()` memanggil `pool.end()`** dan dijalankan `container.close()` pada graceful shutdown, setelah `app.stop()` berhenti menerima request baru. Ini yang membuat `docker stop` menghasilkan `shutdown complete` dengan exit code 0.

## 3. Health check `SELECT 1`

`ping()` menjalankan `db.execute(sql\`SELECT 1\`)` lewat instance Drizzle, jadi pemeriksaan readiness memakai jalur koneksi yang sama dengan query bisnis nanti — bukan koneksi terpisah. Use case `CheckServiceReadiness` membungkus probe dengan batas waktu (`DEFAULT_PROBE_TIMEOUT_MS = 1000` ms) memakai `Promise.race` dan `clearTimeout` di blok `finally`, sehingga database yang menggantung dilaporkan `unavailable`, bukan membuat `/ready` menahan request selamanya.

## 4. Connection string

`buildConnectionString()` dipakai oleh `drizzle.config.ts` (drizzle-kit hanya menerima URL). User dan password di-`encodeURIComponent` agar karakter khusus seperti `dev@123` tidak merusak parsing URL, dan `?ssl=true` ditambahkan saat `DATABASE_SSL=true`:

```text
postgres://root:dev%40123@127.0.0.1:5432/todo_development
```

Fungsi ini adalah satu-satunya tempat kredensial digabungkan menjadi URL. Nilai yang sama tidak pernah dicetak ke log: `describeAppConfig()` hanya menampilkan `user@host:port/name`, dan respons HTTP tidak pernah memuat informasi koneksi.

## 5. Skema dan entri point

Seluruh definisi tabel diekspor dari [src/shared/infrastructure/database/schema/index.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/shared/infrastructure/database/schema/index.ts), yang saat ini berisi `export const schema = {};` — kosong dengan sengaja. Phase 1 tidak mendefinisikan tabel bisnis (User, Workspace, Todo, Tag, Label, Reminder, Notification); membuatnya hanya sebagai placeholder akan melanggar aturan "tidak ada implementasi palsu".

Ketika phase berikutnya menambahkan tabel, definisi Drizzle tinggal diletakkan di module masing-masing (mis. `src/modules/todos/infrastructure/schema/`) lalu di-re-export dari entry point ini supaya drizzle-kit membaca satu titik.

## 6. Konfigurasi drizzle-kit

[drizzle.config.ts](file:///home/daffakhayru/Applications/TodoIt-v2/drizzle.config.ts):

| Opsi | Nilai | Keterangan |
| --- | --- | --- |
| `dialect` | `postgresql` | |
| `schema` | `./src/shared/infrastructure/database/schema/index.ts` | satu titik baca skema |
| `out` | `./drizzle` | lokasi file migration |
| `dbCredentials.url` | `buildConnectionString(appConfig.database)` | mengikuti environment yang dimuat script |
| `migrations.table` | `__drizzle_migrations` | tabel pembukuan migration |
| `migrations.schema` | `public` | |
| `strict` | `true` | drizzle-kit menolak apply bila skema database dan migration tidak sinkron |
| `verbose` | `true` hanya di development | log detail saat generate/migrate |

Konfigurasi dibaca lewat `loadAppConfig()`, jadi script `db:*` yang memuat `--env-file` otomatis memakai database environment tersebut. Karena tidak ada bin shim `node` di mesin ini, script memanggil `bun node_modules/drizzle-kit/bin.cjs` secara eksplisit.

## 7. Alur migration

```bash
# 1. definisikan tabel di src/shared/infrastructure/database/schema/index.ts
# 2. generate SQL migration dari selisih skema
bun run db:generate

# 3. terapkan ke database development
bun run db:migrate

# 4. terapkan ke database test (dipakai integration test)
bun run db:migrate:test

# 5. inspeksi lewat UI
bun run db:studio
```

Status terverifikasi pada Phase 1:

- `bun run db:generate` menghasilkan `drizzle/meta/_journal.json` dengan `entries: []` dan pesan `0 tables ... nothing to migrate`. Ini benar dan bukan kegagalan: tidak ada tabel yang didefinisikan.
- `bun run db:migrate` berhasil dan hanya membuat tabel pembukuan:

```bash
sg docker -c "docker exec todo-postgres psql -U root -d todo_development -c '\dt'"
# public | __drizzle_migrations | table | root
```

- `select count(*) from __drizzle_migrations` mengembalikan `0` (belum ada migration yang dicatat).

Aturan yang berlaku untuk phase berikutnya:

1. Perubahan skema **selalu** lewat file migration yang di-generate lalu di-review; tidak pernah `ALTER TABLE` manual di database.
2. Migration development dan test dijalankan sebelum integration test yang memakai skema baru.
3. Untuk staging/production, migration dijalankan sebagai langkah deploy terpisah, bukan saat aplikasi startup, supaya proses yang di-scale otomatis tidak saling berebut migration.
4. File migration yang sudah pernah diterapkan di lingkungan bersama tidak boleh diedit; buat migration baru sebagai koreksi.

## 8. Lifecycle database lokal

| Kondisi | Perintah | Akibat |
| --- | --- | --- |
| pertama kali dijalankan | `sg docker -c "docker compose up -d postgres"` | volume `todo-postgres-data` dibuat, skrip `infra/postgres/init/00-create-test-database.sql` dijalankan → `todo_development` dan `todo_test` tersedia |
| harian | container `restart: unless-stopped` | data bertahan; tidak perlu init ulang |
| ingin mengulang dari nol | `sg docker -c "docker compose down -v"` lalu `up -d postgres` | **seluruh data development dan test hilang**, skrip init dijalankan lagi |

Keduanya berjalan di host melalui `127.0.0.1:5432` dan di dalam network compose melalui host name `postgres:5432`.

## 9. Pemeriksaan cepat

```bash
sg docker -c "docker exec todo-postgres pg_isready -U root -d todo_development"
sg docker -c "docker exec todo-postgres psql -U root -d todo_development -c 'select version()'"
curl -s http://127.0.0.1:4000/ready
```

Perintah terakhir adalah cara paling langsung memastikan pool aplikasi benar-benar hidup: `{"status":"ready","dependencies":{"database":"connected"}}` berarti `SELECT 1` berhasil; respons 503 dengan kode `SERVICE_UNAVAILABLE` berarti koneksi gagal atau melebihi batas waktu probe.
