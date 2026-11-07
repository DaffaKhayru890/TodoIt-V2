# Konfigurasi Environment

Dokumen ini mendaftar seluruh environment variable yang dikenal aplikasi, tipe nilainya, nilai default, dan perbedaan antar environment. Sumber kebenaran aturan parsing adalah `ENV_RULES` di [src/config/env.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/config/env.ts) dan `parseEnvField` di [src/config/env-schema.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/config/env-schema.ts). Bila dokumen ini dan kode berbeda, kode yang benar dan dokumen wajib diperbarui.

## 1. Cara kerja pemuatan file

Bun memuat environment sendiri, tanpa `dotenv`:

| Cara jalan | File yang dimuat |
| --- | --- |
| `bun run dev` | `NODE_ENV=development` lalu `bun --env-file=.env.development` |
| `bun run start:staging` | `NODE_ENV=staging` lalu `bun --env-file=.env.staging` |
| `bun run start:production` | `NODE_ENV=production` tanpa `--env-file` (konfigurasi disuntik platform) |
| `bun run test` | `bun test --env-file=.env.test` |
| `docker compose up` | `env_file: .env.development` untuk service `backend` |

Dua aturan hasil pengamatan terhadap Bun 1.4 yang perlu diketahui:

1. Tanpa `--env-file`, Bun memuat `.env` dan `.env.<NODE_ENV>`.
2. Dengan `--env-file=X`, Bun **menggantikan** mekanisme penemuan file, sehingga `.env` tidak ikut dimuat. Nilai yang sudah ada di proses (mis. `NODE_ENV=production` dari script, atau `DATABASE_HOST` dari `environment:` compose) **menang** atas nilai di file.

Konsekuensinya setiap `.env.<name>` dibuat *self-contained* (memuat `APP_NAME` dan `APP_VERSION` sendiri), dan `.env` hanya dipakai sebagai tempat nilai bersama untuk kasus Bun dijalankan tanpa `--env-file`.

Perilaku tambahan yang sudah diuji: `--env-file` yang menunjuk ke file tidak ada **tidak** memicu error dari Bun, tetapi tetap mematikan penemuan otomatis. Akibatnya `bun run start:staging` tanpa `.env.staging` akan keluar dengan `EnvironmentConfigurationError` yang mendaftar variabel wajib — bukan pesan "file tidak ditemukan". Ini disengaja: staging/production seharusnya mengambil konfigurasi dari environment deploy, dan startup gagal lebih baik daripada jalan dengan konfigurasi setengah.

## 2. Daftar variabel

### 2.1 Aplikasi

| Variabel | Wajib | Tipe | Default | Keterangan |
| --- | --- | --- | --- | --- |
| `NODE_ENV` | tidak | enum `development` / `test` / `staging` / `production` | `development` | Menentukan environment aktif. Di-set oleh npm script, bukan oleh pengguna. |
| `APP_NAME` | **ya** | string | — | Judul API pada OpenAPI dan log startup. |
| `APP_VERSION` | **ya** | string | — | Versi API pada OpenAPI. |
| `APP_PORT` | tidak | port `1`–`65535` | `4000` | Port HTTP. |
| `APP_HOST` | tidak | string | `0.0.0.0` | Interface bind. `.env.test` memakai `127.0.0.1`. |
| `APP_DEFAULT_TIMEZONE` | tidak | IANA timezone | `UTC` | Timezone default untuk Today/Upcoming/Overdue bila request tidak mengirim query `timezone`. Nilai divalidasi memakai `Intl`; `Asia/Jakarta`, `America/New_York`, dan `UTC` valid. |
| `LOG_LEVEL` | tidak | enum `trace` / `debug` / `info` / `warn` / `error` / `silent` | `info` | Ambang log JSON. `silent` mematikan seluruh log. |
| `CORS_ORIGINS` | tidak | daftar string dipisah koma | `[]` (kosong) | Origin yang diizinkan CORS. Spasi di sekitar tiap item diabaikan; item kosong dibuang. |

### 2.2 Database

| Variabel | Wajib | Tipe | Default | Keterangan |
| --- | --- | --- | --- | --- |
| `DATABASE_HOST` | **ya** | string | — | Host PostgreSQL. Di dalam compose bernilai `postgres`. |
| `DATABASE_PORT` | tidak | port | `5432` | Port PostgreSQL. |
| `DATABASE_USER` | **ya** | string | — | User koneksi. |
| `DATABASE_PASSWORD` | **ya** | string | — | Password koneksi. Tidak pernah dicetak ke log maupun respons. |
| `DATABASE_NAME` | **ya** | string | — | Nama database. |
| `DATABASE_SSL` | tidak | boolean | `false` | `true` menambahkan `ssl: { rejectUnauthorized: true }` pada pool dan `?ssl=true` pada connection string. |

Format boolean yang diterima: `1`/`true`/`yes`/`on` untuk benar, `0`/`false`/`no`/`off` untuk salah (case-insensitive). Nilai lain menghasilkan error konfigurasi.

## 3. Aturan validasi dan kegagalan startup

`loadAppConfig()` ([src/config/app-config.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/config/app-config.ts)) memanggil `parseEnvironment()` yang mengumpulkan **seluruh** masalah sekaligus, lalu melempar `EnvironmentConfigurationError` bila ada satu pun masalah. Contoh output ketika file environment kosong:

```text
Aplikasi tidak dapat dimulai.

  - APP_NAME wajib diisi dan tidak boleh kosong
  - APP_VERSION wajib diisi dan tidak boleh kosong
  - DATABASE_HOST wajib diisi dan tidak boleh kosong
  ...

Periksa file environment pada environment aktif (lihat docs/development/environment-configuration.md).
```

Perilaku ini diuji pada [tests/integration/server-lifecycle.test.ts](file:///home/daffakhayru/Applications/TodoIt-v2/tests/integration/server-lifecycle.test.ts): proses keluar dengan kode `1`, daftar variabel wajib tercetak, dan password tidak pernah muncul di stderr.

Atau bila nilainya salah bentuk:

```text
  - APP_PORT harus integer dalam rentang 1-65535 (ditemukan: "99999")
  - DATABASE_SSL harus bernilai true/false (ditemukan: "mungkin")
  - NODE_ENV harus salah satu dari: development, test, staging, production (ditemukan: "prod")
```

## 4. Pemanfaatan konfigurasi

- `AppConfig` diberikan ke composition root ([src/bootstrap/container.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/bootstrap/container.ts)) dan hanya itu jalurnya; tidak ada module lain yang membaca `process.env`.
- `describeAppConfig()` menghasilkan field log startup yang aman: database dicetak sebagai `user@host:port/name` tanpa password.
- `config.environment` menentukan isi `servers` pada dokumen OpenAPI ([src/shared/presentation/http/plugins/openapi-documentation.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/shared/presentation/http/plugins/openapi-documentation.ts)).
- `config.corsOrigins` diteruskan ke plugin CORS ([src/shared/presentation/http/plugins/cors-policy.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/shared/presentation/http/plugins/cors-policy.ts)). Array kosong diterjemahkan menjadi `origin: false` sehingga tidak ada origin yang diizinkan.
- `config.defaultTimezone` diteruskan ke `TodoDateRangeService` di composition root ([src/bootstrap/container.ts](file:///home/daffakhayru/Applications/TodoIt-v2/src/bootstrap/container.ts)). Endpoint Today/Upcoming/Overdue tetap dapat menimpa nilai ini lewat query `timezone`.

## 5. Perbedaan per environment

| Aspek | development | test | staging | production |
| --- | --- | --- | --- | --- |
| File | `.env.development` | `.env.test` | `.env.staging` | disuntik platform deploy |
| `APP_PORT` | 4000 | 4001 | 4000 | 4000 |
| `APP_HOST` | `0.0.0.0` | `127.0.0.1` | `0.0.0.0` | `0.0.0.0` |
| `DATABASE_NAME` | `todo_development` | `todo_test` | `todo_staging` | `todo_production` |
| `DATABASE_HOST` | `127.0.0.1` (atau `postgres` di compose) | `127.0.0.1` | host managed | host managed |
| `DATABASE_SSL` | `false` | `false` | `true` | `true` |
| `APP_DEFAULT_TIMEZONE` | `UTC` | `UTC` | `UTC` | `UTC` |
| `LOG_LEVEL` | `debug` | `error` | `info` | `info` |
| Kredensial | user `root` + `dev@123` | sama dengan development | user aplikasi terpisah | user aplikasi terpisah |
| Sumber kredensial | file di repo lokal (di-ignore git) | file di repo lokal | secret manager / deployment env | secret manager / deployment env |

## 6. Kebijakan kredensial

- User `root` dengan password `dev@123` adalah milik container PostgreSQL lokal saja. Nilai ini **tidak boleh** dipakai ulang di staging maupun production; aturan ini ditegakkan lewat contoh file (`.env.staging.example`, `.env.production.example` memakai placeholder `__SET_VIA_SECRET_MANAGER__`) dan lewat review, bukan lewat kode.
- Seluruh file environment dikecualikan dari version control lewat pola `.env` dan `.env.*` di `.gitignore`, dengan pengecualian `!.env.*.example` sehingga contoh tetap dapat di-commit. Folder ini belum di-`git init`; saat repository dibuat, pola tersebut sudah benar dan tinggal diperiksa dengan `git status` (file seperti `.env.development` tidak boleh muncul sebagai tracked/untracked yang akan di-commit).

- `.dockerignore` membuang `.env*` dari konteks build, dan stage `production` pada Dockerfile tidak menyalin file environment apa pun. Verifikasi:

```bash
docker run --rm --entrypoint sh <image> -c 'ls -a /app'
# yang ada hanya: bun.lock  dist  node_modules  package.json
```

## 7. Menambah variabel baru

1. Tambahkan rule pada `ENV_RULES` di `src/config/env.ts` (dan varian `EnvFieldRule` baru di `env-schema.ts` bila bentuk datanya belum ada).
2. Petakan nilainya ke field bertipe di `AppConfig` dalam `loadAppConfig()` memakai `readString`/`readNumber`/`readBoolean`/`readStringList`.
3. Perbarui keempat file `.env.*.example` dan tabel di dokumen ini.
4. Tambahkan kasus validasi di [tests/unit/environment-configuration.test.ts](file:///home/daffakhayru/Applications/TodoIt-v2/tests/unit/environment-configuration.test.ts).
5. Variabel rahasia: jangan ikutkan ke `describeAppConfig()` dan tandai bila nanti ada aturan penyamaran nilai.
