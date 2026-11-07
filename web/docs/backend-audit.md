# Audit backend

Pemeriksaan dilakukan terhadap source di root repository. Backend tidak dipindahkan ke folder `backend/`. Memindahkannya dilarang oleh batasan phase ini.

## 1. Ringkasan

Backend adalah modular monolith TypeScript yang dijalankan Bun. Entry API adalah `src/main.ts`. Worker notifikasi terpisah ada di `src/worker.ts`. Framework HTTP adalah Elysia. Database diakses lewat Drizzle ORM dan PostgreSQL. OpenAPI tersedia di `/openapi` dan `/openapi/json`.

## 2. Technology stack

Confirmed:

- Bahasa TypeScript, package `todo-backend`.
- Runtime dan package manager Bun (`package.json` meminta Bun `>=1.4.0`).
- HTTP: Elysia.
- Database: PostgreSQL melalui Drizzle.
- Validasi request: TypeBox (`t` dari Elysia).
- Email: SMTP, di luar transaksi database.
- Antrian job notifikasi: tabel PostgreSQL, bukan Redis.

## 3. Arsitektur

Confirmed:

- Modul berada di `src/modules` (auth, workspace, todo, notification, health).
- Tiap modul memisahkan domain, application, infrastructure, dan presentation.
- Route HTTP ada di `presentation/http`.
- Repository Drizzle ada di `infrastructure/persistence`.
- Konfigurasi tunggal dibaca di `src/config/env.ts` lalu menjadi `AppConfig`.
- Default `APP_PORT` adalah `4000`.

## 4. Autentikasi

Confirmed:

- Prefix `/api/v1/auth`.
- `POST /register` membuat user dan mengembalikan `{ user }` dengan status 201. Password 12–128 karakter.
- `POST /login` mengembalikan `{ user, accessToken, tokenType: "Bearer", expiresIn }`. Refresh token tidak ada di JSON. Refresh token disimpan di cookie HttpOnly `todo_refresh`, path `/api/v1/auth`.
- `POST /refresh` membaca cookie itu, merotasi refresh token, dan mengembalikan access token baru.
- `POST /logout` mencabut session dan menghapus cookie. Status 204.
- `GET /me` memakai Bearer access token. JWT saja tidak cukup: session yang dicabut ditolak.
- Origin refresh dan logout harus ada di allowlist CORS. Kalau tidak, responsnya `403` `ORIGIN_REJECTED`.
- CORS memakai credential. Daftar origin kosong berarti header CORS tidak dikirim. Wildcard ditolak.
- Contoh origin development yang sudah dikenal backend mencakup `http://localhost:3000` dan `http://localhost:5173`.

Not available:

- Penyimpanan refresh token di localStorage atau body JSON.

## 5. Otorisasi

Confirmed:

- Route workspace, todo, dan notifikasi memakai auth guard Bearer.
- Role workspace yang ada: `owner`, `admin`, `member`.
- Beberapa aksi tag/label terbatas ke owner atau admin. Assignment todo boleh dilakukan member.
- Bukan member sering menerima 404, bukan 403, supaya keberadaan workspace tidak terbocor.

## 6. Domain model

Confirmed dari schema Drizzle dan enum:

- User: id, email, displayName, waktu pembuatan.
- Workspace: id, name, description, archivedAt. Tidak ada hard delete publik.
- Member workspace dan role `owner | admin | member`.
- Invitation workspace.
- Todo: title, description, status `todo | in_progress | completed | cancelled`, priority `low | medium | high | urgent`, dueAt, completedAt, labelId, createdBy, soft delete lewat `deletedAt`.
- Tag dan relasi `todo_tags`. Satu todo maksimal 20 tag pada kontrak route.
- Label: satu label utama per todo. Hapus label memakai `ON DELETE SET NULL`.
- Reminder milik todo.
- Notifikasi in-app: tipe yang terlihat di route adalah `reminder_due` dan `todo_due_soon`.
- Preferensi: `inAppEnabled` selalu `true`, `emailEnabled` boolean.

Not available:

- Resource priority terpisah. Priority adalah field todo.
- API publik untuk job queue.
- Push, WebSocket, atau SSE.

## 7. Route

Daftar endpoint dan bentuk body ada di [api-contract.md](api-contract.md). Semua path di dokumen itu diambil dari file route.

## 8. Error

Confirmed:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "pesan aman",
    "requestId": "sama dengan header x-request-id",
    "details": [{ "path": "body.title", "message": "terlalu panjang" }]
  }
}
```

`details` hanya untuk error validasi. Kode stabil ada di `ERROR_CODES`, termasuk `UNAUTHORIZED`, `RATE_LIMITED`, `PAYLOAD_TOO_LARGE`, dan `ORIGIN_REJECTED`.

## 9. Validasi

Confirmed: body, query, dan params divalidasi TypeBox pada definisi route. Validasi gagal memakai kode `VALIDATION_ERROR` dan status 422.

## 10. Kebutuhan integrasi frontend

Confirmed:

- Base URL development `http://localhost:4000`.
- Dev server frontend memakai port 5173 agar cocok dengan origin CORS yang sudah ada.
- Request terautentikasi memakai `Authorization: Bearer <accessToken>`.
- Refresh membutuhkan `credentials: 'include'` dan origin yang diizinkan.
- Access token tidak boleh disimpan sebagai secret build. Refresh token tidak boleh dibaca JavaScript.

## 11. Limitasi

Confirmed:

- Workspace diarsipkan lewat `POST /:workspaceId/archive`, bukan dihapus permanen.
- Email notifikasi at-least-once, bukan exactly-once.
- In-app notification tidak bisa dimatikan.
- Tidak ada endpoint antrian job untuk klien.
- Rate limit dan batas ukuran body ada di backend. Klien harus siap menerima 429 dan 413.

Unclear:

- Angka rate limit per route tidak disalin ke sini. Nilainya ada di konfigurasi backend dan dapat berubah tanpa perubahan kontrak path.
