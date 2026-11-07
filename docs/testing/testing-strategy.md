# Strategi Pengujian

Dokumen ini menjelaskan bagaimana test dibagi, cara menjalankannya, dan konvensi yang wajib diikuti ketika Phase 2 menambahkan module baru. Semua test memakai runner bawaan Bun (`bun:test`) — tidak ada Jest/Vitest.

## 1. Menjalankan test

```bash
bun run test            # semua test (unit + integration), memuat .env.test
bun run test:watch      # ulang otomatis saat file berubah
bun run test:coverage   # ringkasan cakupan per file
bun test tests/unit/health-endpoint.test.ts        # satu file
bun test -t "readiness"                            # berdasarkan nama test
```

Prasyarat: container PostgreSQL hidup, karena integration test terhubung ke database nyata.

```bash
sg docker -c "docker compose up -d postgres"
```

Tanpa database, integration test gagal saat `ping`; unit test tetap lulus karena tidak menyentuh database.

Status terkini yang terverifikasi: **51 test lulus, 0 gagal, 144 assertion, 9 file** (`bun run test`).

## 2. Pembagian direktori

| Direktori | Karakteristik | Butuh PostgreSQL? |
| --- | --- | --- |
| `tests/unit/` | aplikasi dirakit di memori, dependensi eksternal diganti stub, tanpa port | tidak |
| `tests/integration/` | menyentuh pool koneksi nyata, proses server nyata, dan database `todo_test` | ya |
| `tests/helpers/` | factory konfigurasi & aplikasi test, stub probe, pembuat `Request` | — |

`tests/helpers/` tidak berisi test; isinya hanya alat yang dipakai bersama.

## 3. Peta test Phase 1

| File | Jumlah | Yang dijaga |
| --- | --- | --- |
| `tests/unit/health-endpoint.test.ts` | 5 | `/health` 200 + `content-type: application/json` + body `{ status: "ok" }`, tetap 200 saat probe gagal, `x-request-id` baru sekaligus access log JSON yang cocok, id dari klien dipakai ulang, nilai id tidak wajar ditolak |
| `tests/unit/ready-endpoint.test.ts` | 6 | `/ready` 200 saat probe sukses, 503 + `SERVICE_UNAVAILABLE` saat probe gagal maupun melebihi batas waktu, tidak ada potongan internal (`10.0.0.1`, `ECONNREFUSED`, `svc_todo`, `rahasia-test`, `todo_test`, `5432`) di body maupun log, `requestId` body sama dengan header |
| `tests/unit/check-service-readiness.test.ts` | 5 | use case berjalan sendiri tanpa HTTP: `ready`/`unavailable`, probe menggantung kena batas waktu, batas waktu default terpakai, probe dipanggil tepat satu kali |
| `tests/unit/environment-configuration.test.ts` | 11 | default aman, variabel wajib, enum, rentang port, format boolean, parsing CSV, seluruh masalah dikumpulkan sekaligus, password tidak keluar di `describeAppConfig` |
| `tests/unit/error-handling.test.ts` | 7 | 404 / 422 / 400 / 500 memakai sampul error standar, `details` validasi, tidak ada stack trace, dan kebijakan CORS |
| `tests/unit/openapi-documentation.test.ts` | 6 | `/openapi` menyajikan UI, `/openapi/json` 3.1.2, health & readiness tercantum, tag dan server tersedia |
| `tests/integration/database-client.test.ts` | 5 | `ping` nyata + reuse pool, `SELECT 1` lewat Drizzle, query setelah `close()` ditolak, koneksi ke port mati menolak, `buildConnectionString` |
| `tests/integration/ready-endpoint.test.ts` | 4 | `/ready` 200 terhadap PostgreSQL sungguhan, pool yang sama antar request, 503 saat port mati (5433), tidak membocorkan informasi koneksi |
| `tests/integration/server-lifecycle.test.ts` | 2 | proses nyata: startup → `/health`+`/ready` → `SIGTERM` → exit 0 dengan log `server started`/`shutdown started`/`shutdown complete`; dan gagal startup (exit 1) saat konfigurasi kritis hilang |

## 4. Style test HTTP: `app.handle(Request)`

Test HTTP tidak membuka port. `buildTestApp()` merakit aplikasi persis seperti production (`createApp`) tetapi dengan dependensi terkendali, lalu request dikirim langsung:

```ts
const { app } = buildTestApp({ probe: failingProbe });
const response = await app.handle(getRequest('/ready'));

expect(response.status).toBe(503);
```

Manfaatnya: tidak ada tabrakan port saat parallel, tidak ada teardown jaringan, dan yang diuji tetap middleware + plugin + route yang sebenarnya, bukan replika.

Satu-satunya test yang membuka port adalah `server-lifecycle.test.ts`, karena yang diuji justru proses nyata. Ia memakai `Bun.spawn([process.execPath, '--env-file=.env.test', 'src/main.ts'])` dengan `APP_PORT=4111` override, `waitForHttpOk()` sebagai penunggu siap, lalu mengirim sinyal.

## 5. Mock dan stub

Stub dibuat sebagai implementasi port, bukan hasil `spy` pada modul asli:

```ts
export const connectedProbe: DatabaseProbe = { probe: () => Promise.resolve() };
export const failingProbe: DatabaseProbe = {
  probe: () => Promise.reject(new Error('connect ECONNREFUSED 10.0.0.1:5432 user=svc_todo db=todo_test'))
};
export const hangingProbe: DatabaseProbe = { probe: () => new Promise<void>(() => undefined) };
```

`failingProbe` sengaja memuat detail teknis agar test bisa membuktikan detail itu tidak muncul di respons. Log juga di-stub lewat `LogSink` yang mendorong baris ke array `logs` — karena itu test yang memeriksa log harus mengirim `logLevel` (mis. `debug`) secara eksplisit, default-nya `silent`.

## 6. Test database nyata

Integration test memakai `.env.test` (`DATABASE_NAME=todo_test`, `APP_PORT=4001`, `LOG_LEVEL=error`) supaya migration maupun percobaan koneksi tidak mengganggu `todo_development`. Database `todo_test` dibuat otomatis oleh `infra/postgres/init/00-create-test-database.sql` saat volume pertama kali diinisialisasi.

Konvensi:

- Setiap test menutup client/pool-nya (`try/finally` dengan `await client.close()`).
- Test kegagalan koneksi memakai port mati (5433), bukan host acak, agar gagal cepat dan deterministik.
- Phase 2 wajib menjalankan `bun run db:migrate:test` sebelum integration test yang memakai tabel baru, lalu membersihkan baris yang dibuat test tersebut.

## 7. Konvensi penulisan test

1. Nama test describes behavior, bukan fungsi: "mengembalikan 503 ketika database tidak tersedia", bukan "test ready".
2. Verifikasi behavior dan bentuk data (status, header, isi body, efek ke dependensi). Test yang hanya memastikan sebuah fungsi "berhasil dipanggil" ditolak.
3. Arrange–act–assert jelas; `describe` untuk mengelompokkan skenario, satu `test` untuk satu klaim.
4. Assertion negatif ikut ditulis: string internal (`postgres://`, `ECONNREFUSED`, `svc_todo`, `todo_test`, `dev@123`, nilai `DATABASE_HOST`) tidak boleh ada di body respons.
5. Success case, validation error, failure case, dan (kalau nanti ada) authorization behavior diuji untuk setiap endpoint baru.
6. Tidak ada test yang bergantung pada urutan eksekusi test lain, dan tidak ada state global yang dimutasi antar test.
7. Test helper baru masuk `tests/helpers/`, jangan diduplikasi di file test.

## 8. Cakupan

`bun run test:coverage` saat ini menghasilkan **97,06% fungsi / 98,80% baris** keseluruhan, dengan mayoritas file `src/` pada 100%. Yang secara sadar di bawah 100%:

| File | Cakupan | Alasan |
| --- | --- | --- |
| `src/shared/infrastructure/logging/logger.ts` | 70% func / 95% baris (baris 29–30) | `consoleSink` default (stdout/stderr) tidak dipanggil di test dalam proses yang sama karena test selalu menyuntik sink sendiri |
| `src/shared/infrastructure/database/client.ts` | 80% func / 97,06% baris (baris 49) | callback handler `pool.on('error')` untuk koneksi idle yang putus sulit direkayasa tanpa merusak pool |
| `src/config/app-config.ts` | 100% func / 92,59% baris (baris 30, 40, 50, 60) | empat cabang `TypeError` pada pembaca tipe, hanya tercapai bila bentuk data tidak sesuai `ENV_RULES` |
| `src/config/env.ts` | 100% func / 97,62% baris (baris 66) | guard `NODE_ENV` bertipe non-string, tidak mungkin terjadi karena rule sudah enum |
| `src/shared/presentation/http/plugins/openapi-documentation.ts` | 100% func / 97,37% baris (baris 27) | cabang `servers` untuk environment staging/production; test unit memakai development/test |

Dua file tidak muncul di tabel cakupan sama sekali: `src/main.ts` dan `src/bootstrap/container.ts`. Keduanya dieksekusi pada proses child yang di-`Bun.spawn` oleh `tests/integration/server-lifecycle.test.ts`, jadi instrumentasi test in-process tidak melihatnya. Jalur keduanya (startup, listen, shutdown, wiring container) tetap terverifikasi lewat test tersebut, dan itu cara yang benar untuk menguji entrypoint: membandingkan perilaku proses, bukan menghitung baris.

Angka di atas adalah efek samping desain yang mengutamakan dependency injection (sink dan probe selalu bisa diganti) — bukan indikator test yang kurang. Yang dikejar adalah perilaku kritis terlindungi, bukan angka bulat.
