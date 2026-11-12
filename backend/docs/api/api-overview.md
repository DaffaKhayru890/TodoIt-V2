# API — Overview

## 1. Base URL dan Versioning

| Environment | Base URL |
|---|---|
| Development | `http://localhost:8080` |
| Staging | `https://api.staging.todoit.example` |
| Production | `https://api.todoit.example` |

- Semua endpoint bisnis memakai prefix **`/api/v1`**.
- Health tidak memakai prefix versi: `/health`, `/ready`.
- Versi dinaikkan hanya jika ada breaking change. Penambahan field opsional bukan breaking
  change dan tidak menaikkan versi.
- Tidak ada versioning via header. Alasan: sederhana dan mudah di-cache/di-route.

## 2. Format Data

| Aspek | Aturan |
|---|---|
| Content-Type request | `application/json` (kecuali GET tanpa body) |
| Content-Type response | `application/json; charset=utf-8` |
| Encoding | UTF-8 |
| Naming field | `snake_case` |
| Waktu | RFC3339 UTC (`2026-11-12T10:00:00Z`) |
| ID | UUID string |
| Null | `null` eksplisit jika field nullable |
| Enum | UPPER_SNAKE (`TODO`, `IN_PROGRESS`, `OWNER`) |
| Boolean | `true`/`false` |
| Angka | JSON number, tanpa string |

## 3. Autentikasi

- Endpoint privat memerlukan `Authorization: Bearer <access_token>`.
- Token tidak diterima lewat query string atau cookie.
- Endpoint publik:
  - `POST /api/v1/auth/register`
  - `POST /api/v1/auth/login`
  - `POST /api/v1/auth/refresh`
  - `POST /api/v1/invitations/{token}/accept` (butuh Bearer, tetapi bukan member workspace)
  - `GET /health`
  - `GET /ready`
- Endpoint Swagger UI (`/swagger/*any`) publik di development; production dapat dimatikan
  lewat `SWAGGER_ENABLED=false`.

## 4. Envelope Response

Semua response (sukses maupun error) memakai envelope:

```json
{
  "success": true,
  "message": "Tasks retrieved successfully",
  "data": [],
  "pagination": {
    "limit": 20,
    "next_cursor": null,
    "has_more": false
  }
}
```

- `pagination` hanya ada pada endpoint list dengan cursor.
- `meta` hanya ada pada endpoint tertentu (view tanggal).
- Detail lengkap: [`response-convention.md`](response-convention.md).

## 5. HTTP Status yang Dipakai

| Status | Penggunaan |
|---|---|
| 200 OK | GET, PATCH, POST aksi (complete/reopen/read/accept) |
| 201 Created | POST create resource |
| 204 No Content | DELETE, logout |
| 400 Bad Request | JSON invalid, parameter tidak dapat diparse |
| 401 Unauthorized | Token tidak ada/invalid/expired, kredensial salah |
| 403 Forbidden | Role tidak cukup |
| 404 Not Found | Resource/workspace tidak ditemukan atau bukan member |
| 409 Conflict | Duplikat, state transition tidak valid, owner protected |
| 410 Gone | Invitation expired |
| 422 Unprocessable Entity | Validasi field gagal, ID referensi tidak valid |
| 429 Too Many Requests | Rate limit |
| 500 Internal Server Error | Error tak terduga |
| 503 Service Unavailable | Readiness gagal |

Tidak memakai 418. Route yang tidak ada dinormalisasi menjadi 404 `ROUTE_NOT_FOUND`, dan
method yang salah pada path yang ada menjadi 405 `METHOD_NOT_ALLOWED` (lihat
`error-convention.md`).

## 6. Konvensi Penamaan Endpoint

- Resource plural: `/workspaces`, `/tasks`, `/tags`, `/labels`, `/reminders`,
  `/notifications`.
- Nested resource mengikuti kepemilikan: `/workspaces/{workspace_id}/tasks/{task_id}`.
- Aksi non-CRUD memakai kata kerja di akhir: `/complete`, `/reopen`, `/read`, `/read-all`,
  `/accept`.
- Path parameter `snake_case`: `{workspace_id}`, `{task_id}`, `{invitation_id}`.
- Query parameter `snake_case`: `assignee_id`, `due_from`, `include_completed`.
- Tidak memakai trailing slash. `/tasks` dan `/tasks/` dianggap sama oleh Gin redirect, tetapi
  kontrak hanya mendefinisikan tanpa slash.
- Filter list memakai query parameter, bukan path.

## 7. Ringkasan Endpoint

| Module | Jumlah | Prefix |
|---|---|---|
| Auth | 6 | `/api/v1/auth` |
| Users | 2 | `/api/v1/users` |
| Workspaces | 5 | `/api/v1/workspaces` |
| Members | 3 | `/api/v1/workspaces/{workspace_id}/members` |
| Invitations | 4 | `/api/v1/workspaces/{workspace_id}/invitations`, `/api/v1/invitations` |
| Tasks | 7 | `/api/v1/workspaces/{workspace_id}/tasks` |
| Task views | 3 | `/api/v1/workspaces/{workspace_id}/tasks/views` |
| Tags | 4 | `/api/v1/workspaces/{workspace_id}/tags` |
| Labels | 4 | `/api/v1/workspaces/{workspace_id}/labels` |
| Reminders | 4 | `/api/v1/workspaces/{workspace_id}/tasks/{task_id}/reminders` |
| Notifications | 3 | `/api/v1/notifications` |
| Health | 2 | `/health`, `/ready` |
| **Total** | **47** | |

Daftar lengkap dengan kontrak: [`endpoint-planning.md`](endpoint-planning.md).

## 8. Health Endpoints

### `GET /health`

- Tujuan: liveness. Menjawab selama proses hidup.
- Auth: publik.
- Response 200:

```json
{"success": true, "message": "OK", "data": {"status": "ok", "version": "0.1.0"}}
```

- Tidak menyentuh database.

### `GET /ready`

- Tujuan: readiness. Memeriksa koneksi database.
- Auth: publik.
- Response 200: `{"success":true,"message":"Ready","data":{"status":"ready","checks":{"database":"ok"}}}`
- Response 503: `{"success":false,"error":{"code":"NOT_READY","message":"Service is not ready","details":{"database":"failed"}}}`

Keputusan: readiness **tidak** memeriksa worker agar kegagalan worker tidak memicu restart
loop. Status worker dicatat di log dan (Phase 9) metrik.

## 9. Swagger UI dan OpenAPI

| Aspek | Keputusan |
|---|---|
| Spesifikasi | OpenAPI **3.0.3** |
| Alasan 3.0.3 | Kompatibilitas Swagger UI dan tooling codegen yang stabil |
| Lokasi file | `docs/openapi/openapi.yaml` (Phase 7) |
| Swagger UI | `/swagger/index.html` |
| Sumber anotasi | Hand-written YAML sebagai sumber kebenaran, divalidasi di CI |
| Sinkronisasi | Test kontrak membandingkan route Gin dengan path OpenAPI |

Alasan tidak memakai anotasi komentar di handler: YAML terpusat lebih mudah direview,
di-diff, dan dipakai untuk generate client. Anotasi komentar tersebar dan rawan tidak
konsisten.

Endpoint `/swagger` hanya aktif jika `SWAGGER_ENABLED=true`. Production default `false`
kecuali ada kebutuhan internal.

## 10. CORS

- Origin allowlist dari env `CORS_ALLOWED_ORIGINS` (comma-separated).
- Method: `GET, POST, PATCH, DELETE, OPTIONS`.
- Header: `Authorization, Content-Type, X-Request-ID`.
- Credential: tidak dipakai (token di header), sehingga `Access-Control-Allow-Credentials`
  tidak diaktifkan.
- Development boleh `http://localhost:5173`, `http://localhost:3000`.
- Production **tidak** boleh `*` jika ingin membatasi; jika `*`, kredensial tetap tidak
  diaktifkan.

## 11. Request ID dan Logging

- Setiap request memiliki `X-Request-ID`; jika client mengirim, nilainya dipakai (validasi
  format, maks 64 char), jika tidak dibuat UUID.
- Response menyertakan header `X-Request-ID`.
- Error 500 menyertakan `request_id` di body agar mudah dicari di log.
- Log akses tidak mencatat body, password, token, atau query string yang mengandung token.

## 12. Idempotensi HTTP

| Endpoint | Sifat |
|---|---|
| `POST /auth/logout` | Idempoten |
| `POST /tasks/{id}/complete` | Idempoten |
| `POST /tasks/{id}/reopen` | Idempoten |
| `PATCH /notifications/{id}/read` | Idempoten |
| `POST /notifications/read-all` | Idempoten |
| `POST /invitations/{token}/accept` | Tidak idempoten (accept kedua → 409) |
| POST create lainnya | Tidak idempoten |

Tidak ada `Idempotency-Key` pada Phase 0. Untuk create yang rentan double-submit, client
menonaktifkan tombol; server tetap menjaga constraint (mis. unique membership).

## 13. Konflik Routing: Task Views

Requirement menyebut:

```text
GET /api/v1/workspaces/{workspace_id}/tasks/today
GET /api/v1/workspaces/{workspace_id}/tasks/upcoming
GET /api/v1/workspaces/{workspace_id}/tasks/overdue
```

Gin (httprouter tree) tidak mengizinkan segmen statis dan parameter pada posisi yang sama
dalam beberapa versi. Untuk menghindari panic saat registrasi, rekomendasi:

```text
GET /api/v1/workspaces/{workspace_id}/tasks/views/today
GET /api/v1/workspaces/{workspace_id}/tasks/views/upcoming
GET /api/v1/workspaces/{workspace_id}/tasks/views/overdue
```

Keputusan: **pakai `/views/...`**. Ini eksplisit, tidak konflik, dan mudah diperluas
(`/views/completed`). Kontrak di `endpoint-planning.md` memakai bentuk ini. Jika requirement
harus dipertahankan persis, alternatifnya adalah query `?view=today` pada list — tetapi itu
mengaburkan semantik dan tetap perlu penanganan khusus.

## 14. Konflik: Token Undangan di Path

Baseline: `POST /api/v1/invitations/{token}/accept`.

Token di path berisiko tercatat di access log, reverse proxy, dan browser history. Rekomendasi:

```http
POST /api/v1/invitations/accept
Content-Type: application/json

{"token": "..."}
```

Keputusan Phase 0: **implementasikan bentuk body** sebagai kontrak utama, dan sediakan path
`/{token}/accept` sebagai alias opsional dengan aturan logging redaksi. Dokumen
`endpoint-planning.md` mendokumentasikan keduanya, dengan body sebagai rekomendasi.

## 15. Konflik: `/auth/me` vs `/users/me`

Keduanya dipertahankan dengan pembagian jelas:

| Endpoint | Isi | Digunakan untuk |
|---|---|---|
| `GET /auth/me` | Identitas + session aktif | Cek login, info device |
| `GET /users/me` | Profil lengkap | Halaman profil/settings |

Frontend tidak perlu memanggil keduanya sekaligus.

## 16. Batasan Ukuran Request

| Aspek | Batas |
|---|---|
| Body | 1 MB (`MAX_BODY_BYTES`) |
| `limit` pagination | 100 |
| Panjang `q` | 100 karakter |
| Jumlah `tag_ids`/`label_ids` per request | 50 |
| Jumlah `status` filter | 3 |
| Timeout request | 30 detik (server read/write) |

Melebihi batas → 413 `PAYLOAD_TOO_LARGE` (body) atau 422 (field).

## 17. Prinsip Desain API

1. Resource-oriented, aksi eksplisit hanya untuk transisi state.
2. Response konsisten; client dapat memakai satu parser.
3. Error memiliki kode stabil, bukan hanya pesan.
4. Pagination cursor untuk semua list yang dapat tumbuh.
5. Tidak ada data sensitif di URL.
6. Otorisasi selalu di server; ID bukan izin.
7. Field response tidak membocorkan internal (mis. `password_hash`, `token_hash`).
8. Waktu selalu UTC; client mengonversi.
9. Endpoint baru wajib memiliki entri OpenAPI dan test.
