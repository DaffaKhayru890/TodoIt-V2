# Aturan Dependency

Aturan ini **wajib** diikuti setiap kali menambah module, file, atau dependency. Tujuannya satu:
business logic harus tetap dapat dijalankan dan diuji tanpa Elysia, Drizzle, atau PostgreSQL.

## 1. Arah impor

Boleh:

```text
presentation  → application → domain
presentation  → shared/presentation (helper HTTP, error envelope, request id)
application   → shared/domain, shared/application
infrastructure→ application/domain (implementasi port), shared/infrastructure
bootstrap     → semua layer (hanya di sini implementasi konkret dipertemukan)
config        → tidak mengimpor layer lain
```

Tidak boleh:

```text
domain        → presentation | application | infrastructure | config | elysia | drizzle-orm | pg
application   → presentation | infrastructure | elysia | drizzle-orm | pg | process.env
presentation  → infrastructure (query, client, mapper)
infrastructure→ presentation
module A      → module B/infrastructure
module A      → module B/presentation
```

## 2. Checklist saat menambah module baru

1. Buat `src/modules/<nama>/{application,infrastructure,presentation}` dan `domain/` **hanya bila
   ada isinya**. Jangan buat file kosong untuk melengkapi struktur.
2. Definisikan business rule di `domain/`, tanpa dependency apa pun.
3. Definisikan use case di `application/`; terima dependency lewat argumen konstruktor/fungsi
   (explicit dependencies). Interface/port dimiliki `application/` (atau `domain/` bila berupa
   repository contract).
4. Implementasikan port di `infrastructure/`. Semua query Drizzle dan mapper tabel→domain hidup
   di sini.
5. Buat route di `presentation/http/` dengan schema TypeBox (`t.Object`, dll.) yang sekaligus
   menjadi dokumentasi OpenAPI. Route memanggil use case, tidak memuat logika bisnis.
6. Daftarkan route di `src/bootstrap/register-modules.ts` dan sambungkan dependency di
   `src/bootstrap/container.ts`.
7. Tambahkan unit test (dengan stub port) **dan** integration test (dengan PostgreSQL nyata).
   Phase berikutnya tidak boleh menutup endpoint tanpa test success, validation error, dan failure.

## 3. Aturan khusus

**Framework & HTTP**
- Elysia hanya muncul di `presentation/` dan `bootstrap/create-app.ts`.
- Use case tidak menerima objek context Elysia (`{ body, set, headers, ... }`).
- Handler route tidak menulis SQL, tidak memanggil `fetch` ke service eksternal, dan tidak
  memuat aturan bisnis.

**Database & ORM**
- `drizzle-orm` dan `pg` hanya boleh diimpor dari `src/shared/infrastructure/**` dan
  `src/modules/*/infrastructure/**`.
- Entity Domain tidak memakai tipe tabel Drizzle (`InferSelectModel`, dll.).
- Query tidak dibuat per request baru; selalu pakai `DatabaseClient` dari composition root.
- Perubahan skema hanya lewat migration (`bun db:generate` → `bun db:migrate`), tidak pernah
  manual di database.

**Konfigurasi**
- `process.env` hanya dibaca di `src/config/env.ts`. Module lain menerima `AppConfig`.
- Variabel baru wajib dideklarasikan di `ENV_RULES` (`src/config/env.ts`) beserta aturan
  parsing-nya, ditambahkan ke semua file `.env.*.example`, dan didokumentasikan di
  [environment-configuration.md](../development/environment-configuration.md).

**Error**
- Error internal tidak pernah dikirim ke klien. Gunakan `mapErrorToHttpResponse()` sehingga
  respons selalu berbentuk `{ "error": { "code", "message", "requestId" } }`.
- Pesan error untuk klien bersifat generik; detail masuk ke structured log bersama `requestId`.

**State & testing**
- Tidak ada mutable state level module dan tidak ada singleton yang dipakai implisit. Objek
  dibuat di composition root lalu diteruskan sebagai argumen.
- Setiap fungsi/objek yang dipakai test harus dapat dibangun tanpa menjalankan server
  (`createApp()` diuji lewat `app.handle(Request)`).
- Test tidak boleh bergantung pada urutan eksekusi test lain.

## 4. Cara memverifikasi

Belum ada lint rule arsitektur otomatis pada Phase 1. Verifikasi dilakukan dengan:

```bash
grep -rn "from 'drizzle-orm'\|from 'pg'" src/modules/*/domain src/modules/*/application
# harus kosong

grep -rn "from 'elysia'" src/modules/*/domain src/modules/*/application src/shared/infrastructure
# harus kosong

grep -rn "process.env" src
# hanya src/config/env.ts (dan entry point test/tooling bila perlu)
```

Bila salah satu pemeriksaan di atas menghasilkan keluaran, perbaikinya adalah memindahkan kode ke
layer yang benar — bukan menambah pengecualian.
