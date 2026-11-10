# Kontrak API

Base URL development: `http://localhost:4000`.

Error untuk endpoint di bawah memakai sampul:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "pesan",
    "requestId": "req-id"
  }
}
```

Autentikasi Bearer berarti header `Authorization: Bearer <token>`.

## Ringkasan status integrasi Phase 5

| Kebutuhan              | Status              | Keterangan                                     |
| ---------------------- | ------------------- | ---------------------------------------------- |
| CRUD tag               | Available           | Workspace-scoped, owner/admin                  |
| Assignment tag         | Available           | Replace all atau tambah/lepas satu             |
| CRUD label             | Available           | Workspace-scoped, owner/admin                  |
| Assignment label       | Available           | Satu label utama per todo                      |
| Priority               | Available           | Field enum todo                                |
| Due date               | Available           | Instant ISO dengan timezone eksplisit          |
| Reminder               | Available           | Resource anak todo; delivery bergantung worker |
| Filter todo            | Partially supported | `active` dan `no-date` client-side             |
| Today/Upcoming/Overdue | Available           | Endpoint khusus dengan `timezone`              |
| Sorting                | Not available       | Client-side pada halaman pertama               |
| Pagination lanjutan    | Not available di UI | Backend cursor tersedia                        |

## Authentication API

### Register

**Status:** Available

**Method:** POST

**Endpoint:** `/api/v1/auth/register`

**Authentication:** Tidak

### Request

```json
{
  "email": "ada@example.com",
  "displayName": "Ada",
  "password": "minimal-12-karakter"
}
```

### Response

Status 201.

```json
{
  "user": {
    "id": "uuid",
    "email": "ada@example.com",
    "displayName": "Ada",
    "createdAt": "2026-11-07T00:00:00.000Z"
  }
}
```

### Notes

Email dinormalisasi. Bentrok email memakai error `EMAIL_ALREADY_EXISTS`.

### Login

**Status:** Available

**Method:** POST

**Endpoint:** `/api/v1/auth/login`

**Authentication:** Tidak

### Request

```json
{
  "email": "ada@example.com",
  "password": "minimal-12-karakter"
}
```

### Response

```json
{
  "user": { "id": "uuid", "email": "ada@example.com", "displayName": "Ada" },
  "accessToken": "jwt",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

### Notes

Refresh token disetel sebagai cookie HttpOnly `todo_refresh` pada path `/api/v1/auth`. JSON login tidak memuat refresh token.

### Refresh token

**Status:** Available

**Method:** POST

**Endpoint:** `/api/v1/auth/refresh`

**Authentication:** Cookie `todo_refresh`

### Response

```json
{
  "accessToken": "jwt-baru",
  "tokenType": "Bearer",
  "expiresIn": 900
}
```

### Notes

Cookie dirotasi. Origin harus lolos CORS. Frontend harus mengirim `credentials: "include"`.

### Logout

**Status:** Available

**Method:** POST

**Endpoint:** `/api/v1/auth/logout`

**Authentication:** Cookie refresh

### Response

Status 204, tanpa body.

### Get current user

**Status:** Available

**Method:** GET

**Endpoint:** `/api/v1/auth/me`

**Authentication:** Bearer

### Response

```json
{
  "user": { "id": "uuid", "email": "ada@example.com", "displayName": "Ada" }
}
```

### Notes

Session yang sudah dicabut ditolak meskipun JWT masih bisa di-decode.

## Workspace API

Semua endpoint workspace memakai Bearer.

### Laporan Status Integrasi Workspace (Phase 3)

| Fitur             | Ketersediaan API Backend                                  | Status Implementasi Frontend | Catatan                                                                           |
| ----------------- | --------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------------- |
| List workspace    | Verified (`GET /api/v1/workspaces`)                       | PASS                         | Diintegrasikan dengan TanStack Query (`useWorkspaces`) dan Primary Sidebar        |
| Workspace detail  | Verified (`GET /api/v1/workspaces/:workspaceId`)          | PASS                         | Diintegrasikan pada `WorkspacePage` (`useWorkspace`)                              |
| Create workspace  | Verified (`POST /api/v1/workspaces`)                      | PASS                         | Diintegrasikan pada `CreateWorkspaceDialog` (`useCreateWorkspace`)                |
| Update workspace  | Verified (`PATCH /api/v1/workspaces/:workspaceId`)        | PASS                         | Diintegrasikan pada `EditWorkspaceDialog` (`useUpdateWorkspace`, hanya owner)     |
| Delete workspace  | Not available                                             | **BLOCKED**                  | Backend tidak mendukung hard delete; penonaktifan memakai soft archive            |
| Archive workspace | Verified (`POST /api/v1/workspaces/:workspaceId/archive`) | PASS                         | Diintegrasikan pada `ArchiveWorkspaceDialog` (`useArchiveWorkspace`, hanya owner) |

### Aturan otorisasi workspace (hasil audit source code)

- Semua endpoint memerlukan Bearer token.
- Role pengguna pada workspace: `owner`, `admin`, `member`.
- `GET /workspaces` hanya mengembalikan workspace aktif (`archived_at IS NULL`) tempat pengguna menjadi anggota.
- `GET /workspaces/:workspaceId` mengembalikan **404** `WORKSPACE_ACCESS_DENIED` untuk non-member dan workspace terarsip (bukan 403), guna mencegah enumerasi UUID.
- `PATCH` dan `POST /archive` hanya untuk `owner`. Non-member mendapat 404; `admin`/`member` mendapat 403 `WORKSPACE_PERMISSION_DENIED`.
- Tidak ada dukungan `color`, `icon`, `slug`, unique name, atau hard delete.

### Create workspace

**Status:** Available

**Method:** POST

**Endpoint:** `/api/v1/workspaces`

### Request

```json
{ "name": "Personal", "description": "opsional" }
```

### Response

Status 201, `{ "workspace": { "id", "name", "description", "role", "createdAt", "updatedAt", "archivedAt" } }`. Pembuat menjadi owner.

### Get workspace list

**Status:** Available

**Method:** GET

**Endpoint:** `/api/v1/workspaces`

### Request

Query `limit` (1–50, default 20) dan `offset` (default 0).

### Response

`{ "items": [...], "pagination": { "limit", "offset", "total" } }`. Item memuat id, name, description, role, createdAt.

### Get workspace detail

**Status:** Available

**Method:** GET

**Endpoint:** `/api/v1/workspaces/:workspaceId`

### Response

Status 200, `{ "workspace": { id, name, description, role, createdAt, updatedAt, archivedAt } }`.
Non-member dan workspace terarsip menghasilkan 404 `WORKSPACE_ACCESS_DENIED`.

### Update workspace

**Status:** Available

**Method:** PATCH

**Endpoint:** `/api/v1/workspaces/:workspaceId`

Body memuat field name dan description yang opsional, sesuai schema route.

### Delete workspace

**Status:** Not available

Tidak ada hard delete. Pengarsipan memakai endpoint berikut.

### Archive workspace

**Status:** Available

**Method:** POST

**Endpoint:** `/api/v1/workspaces/:workspaceId/archive`

### Workspace members

**Status:** Available

- `GET /api/v1/workspaces/:workspaceId/members`
- `GET /api/v1/workspaces/:workspaceId/members/:userId`
- `PATCH /api/v1/workspaces/:workspaceId/members/:userId`
- `DELETE /api/v1/workspaces/:workspaceId/members/:userId`
- `POST /api/v1/workspaces/:workspaceId/leave`
- `POST /api/v1/workspaces/:workspaceId/transfer-ownership`

Bukan member sering menerima 404.

## Todo API

Prefix `/api/v1/workspaces`. Bearer wajib. Todo terhapus tidak dikembalikan.

Seluruh anggota workspace (`owner`, `admin`, `member`) boleh melihat, membuat, mengubah, menyelesaikan, dan menghapus todo. Non-member atau workspace arsip menghasilkan `404` dengan kode `WORKSPACE_ACCESS_DENIED`; role yang ditolak menghasilkan `403 WORKSPACE_PERMISSION_DENIED`.

### Get todos

**Status:** Available

**Method:** GET

**Endpoint:** `/api/v1/workspaces/:workspaceId/todos`

Query: `limit` (1–100, default 20), `cursor`, serta filter `status`, `priority`, `dueFrom`, `dueTo`, `createdFrom`, `createdTo`, `q`, `tagIds`, dan `labelId`. Pagination adalah keyset, bukan total count. Phase 5 frontend memakai `limit=100` dan satu halaman pertama.

Detail filter:

- `status`: `todo`, `in_progress`, `completed`, `cancelled`.
- `priority`: `low`, `medium`, `high`, `urgent`.
- `dueFrom` / `dueTo`: ISO 8601 dengan timezone eksplisit, inklusif.
- `createdFrom` / `createdTo`: ISO 8601 dengan timezone eksplisit, inklusif.
- `q`: pencarian case-insensitive pada `title` dan `description`, maksimal 200 karakter.
- `tagIds`: UUID, boleh diulang (`?tagIds=a&tagIds=b`), semantics **ANY**.
- `labelId`: UUID satu label.
- Tidak ada parameter sorting. Sorting dilakukan frontend pada halaman yang dimuat.

**Response 200**

```json
{
  "items": [
    {
      "id": "uuid",
      "workspaceId": "uuid",
      "title": "Menyusun rencana sprint",
      "description": null,
      "status": "todo",
      "priority": "low",
      "dueAt": null,
      "completedAt": null,
      "label": null,
      "tags": [],
      "createdBy": "uuid",
      "createdAt": "2026-11-07T09:00:00.000Z",
      "updatedAt": "2026-11-07T09:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 100,
    "hasMore": false,
    "nextCursor": null
  }
}
```

Juga tersedia:

- `GET /:workspaceId/todos/today` — `timezone`, `includeCompleted` (default false), `limit`, `cursor`, `tagIds`, `labelId`. Rentang `[awal hari ini, awal hari besok)`; `cancelled` selalu dikecualikan.
- `GET /:workspaceId/todos/upcoming` — `timezone`, `days` (1–30, default 7), `limit`, `cursor`, `tagIds`, `labelId`. Rentang mulai besok; `completed` dan `cancelled` dikecualikan.
- `GET /:workspaceId/todos/overdue` — `timezone`, `limit`, `cursor`, `tagIds`, `labelId`. `dueAt` sebelum awal hari ini; `completed` dan `cancelled` dikecualikan.

Ketiga endpoint memakai kursor dan tidak mengirim total count. `timezone` adalah IANA timezone; jika kosong backend memakai `APP_DEFAULT_TIMEZONE`.

### Get todo detail

**Status:** Available

**Method:** GET

**Endpoint:** `/api/v1/workspaces/:workspaceId/todos/:todoId`

**Response 200:** `{ "todo": { ... } }`. Todo yang tidak ada, sudah dihapus, atau berada di workspace lain menghasilkan `404 TODO_NOT_FOUND`.

### Create todo

**Status:** Available

**Method:** POST

**Endpoint:** `/api/v1/workspaces/:workspaceId/todos`

### Request

```json
{
  "title": "Belanja",
  "description": "opsional",
  "priority": "low",
  "dueAt": "2026-11-10T09:00:00+07:00"
}
```

`title` wajib 1–200 karakter. `description` opsional maksimal 5000 karakter. `priority` opsional dan default-nya `low`. `dueAt` opsional: ISO 8601 dengan timezone eksplisit atau `null`. Status tidak boleh dikirim klien. Create tidak menerima `tagIds` atau `labelId`; metadata tersebut disimpan setelah todo dibuat. Phase 5 mengirim `title`, `description`, `priority` (jika bukan default), dan `dueAt` (jika diisi).

### Response

Status 201. Objek todo memuat id, workspaceId, title, description, status, priority, dueAt, completedAt, label, tags, createdBy, createdAt, updatedAt.

### Update todo

**Status:** Available

**Method:** PATCH

**Endpoint:** `/api/v1/workspaces/:workspaceId/todos/:todoId`

Body parsial: `title`, `description`, `status`, `priority`, `dueAt`, `labelId`. Schema memakai `additionalProperties: false` dan `minProperties: 1`, jadi field `undefined` tidak boleh ikut dikirim. `labelId: null` menghapus label. `tagIds` **tidak** diterima di PATCH; tag diganti melalui `PUT /todos/:todoId/tags`. Reopen di frontend memakai `{ "status": "todo" }` karena tidak ada endpoint reopen khusus.

### Complete todo

**Status:** Available

**Method:** PATCH

**Endpoint:** `/api/v1/workspaces/:workspaceId/todos/:todoId/complete`

Tanpa body. Respons berisi todo terbaru dengan `status` `completed` dan `completedAt` terisi.

### Delete todo

**Status:** Available

**Method:** DELETE

**Endpoint:** `/api/v1/workspaces/:workspaceId/todos/:todoId`

Soft delete, idempoten, respons `204 No Content`. Field `deletedAt` tidak dikirim pada representasi todo aktif. Tidak ada endpoint restore/hard delete yang dipakai frontend.

### Status dan priority

- Status: `todo`, `in_progress`, `completed`, `cancelled`.
- Priority: `low`, `medium`, `high`, `urgent`.

Frontend menampilkan `todo`/`in_progress` sebagai aktif dan `completed` sebagai selesai. `cancelled` tidak dirender sebagai item aktif dan tidak dihitung overdue.

## Metadata API

### Tags

**Status:** Available.

- `POST /api/v1/workspaces/:workspaceId/tags` — body `{ "name": "backend" }`, `name` 1–50 karakter, unik case-insensitive per workspace.
- `GET /api/v1/workspaces/:workspaceId/tags?limit&cursor&q` — list dengan cursor pagination.
- `GET /api/v1/workspaces/:workspaceId/tags/:tagId`
- `PATCH /api/v1/workspaces/:workspaceId/tags/:tagId` — body `{ "name": "..." }`.
- `DELETE /api/v1/workspaces/:workspaceId/tags/:tagId` — `204`.
- `PUT /api/v1/workspaces/:workspaceId/todos/:todoId/tags` — body `{ "tagIds": ["uuid"] }`, mengganti seluruh tag. Array kosong melepas semua tag.
- `POST /api/v1/workspaces/:workspaceId/todos/:todoId/tags/:tagId`
- `DELETE /api/v1/workspaces/:workspaceId/todos/:todoId/tags/:tagId`

CRUD tag hanya untuk `owner` dan `admin` (`MANAGE_METADATA`). Assignment tag boleh dilakukan semua member. Maksimal 20 tag per todo.

### Labels

**Status:** Available.

- `POST /api/v1/workspaces/:workspaceId/labels` — body `{ "name": "...", "color": "#3498DB", "description": null }`.
- `GET /api/v1/workspaces/:workspaceId/labels?limit&cursor&q`
- `GET /api/v1/workspaces/:workspaceId/labels/:labelId`
- `PATCH /api/v1/workspaces/:workspaceId/labels/:labelId` — body parsial `name`, `color`, `description`.
- `DELETE /api/v1/workspaces/:workspaceId/labels/:labelId` — `204`.
- `PUT /api/v1/workspaces/:workspaceId/todos/:todoId/label` — body `{ "labelId": "uuid" }`, mengganti label utama.
- `DELETE /api/v1/workspaces/:workspaceId/todos/:todoId/label` — melepas label.

`name` 1–50 karakter, unik case-insensitive per workspace. `color` wajib `#RRGGBB` (disimpan uppercase). `description` opsional maksimal 300 karakter dan dapat `null`. Satu todo punya satu label utama. CRUD hanya `owner`/`admin`; assign/clear boleh semua member.

### Priority

**Status:** Available sebagai field todo, bukan resource.

Nilai: `low`, `medium`, `high`, `urgent`. Default create `low`. Tidak ada endpoint priority terpisah dan tidak ada sorting priority server-side.

### Due date

**Status:** Available sebagai field `dueAt` pada create dan update todo. Tidak ada endpoint due date terpisah.

`dueAt` adalah instant ISO 8601 dengan timezone eksplisit atau `null`. Backend menolak string tanpa timezone eksplisit. Tidak ada date-only.

### Reminders

**Status:** Available.

- `POST /api/v1/workspaces/:workspaceId/todos/:todoId/reminders` — body `{ "triggerType": "before_due", "offsetMinutes": 15 }` atau `{ "triggerType": "absolute", "remindAt": "..." }`.
- `GET /api/v1/workspaces/:workspaceId/todos/:todoId/reminders?status&limit&cursor` — `status` default `scheduled`; nilai `scheduled`, `cancelled`, atau `all`.
- `GET /api/v1/workspaces/:workspaceId/todos/:todoId/reminders/:reminderId`
- `PATCH /api/v1/workspaces/:workspaceId/todos/:todoId/reminders/:reminderId` — `triggerType` immutable; `before_due` hanya `offsetMinutes`, `absolute` hanya `remindAt`.
- `DELETE /api/v1/workspaces/:workspaceId/todos/:todoId/reminders/:reminderId` — membatalkan reminder (`status=cancelled`), bukan hard delete.

`triggerType`: `absolute` atau `before_due`. `offsetMinutes` 1–43.200 dan hanya untuk `before_due`; reminder `before_due` memerlukan todo dengan `dueAt`. `remindAt` harus di masa depan untuk `absolute`. `status`: `scheduled` atau `cancelled`. `effectiveAt` dihitung backend (`remindAt` atau `dueAt - offsetMinutes`).

Backend memiliki Notification Engine/worker untuk memproses job reminder. Pengiriman aktual bergantung pada konfigurasi deployment (`notificationWorkerEnabled`, database, email). Frontend hanya menyimpan konfigurasi dan tidak memakai timer browser.

### Sorting

**Status:** Not available.

Tidak ada parameter `sort`, `sortBy`, `order`, atau sejenis pada endpoint todo. Frontend mengurutkan halaman pertama secara client-side. Dokumentasi lengkap ada di [filtering-and-sorting.md](filtering-and-sorting.md).

## Collaboration API

**Status:** Available

- `POST /api/v1/workspaces/:workspaceId/invitations`
- `GET /api/v1/workspaces/:workspaceId/invitations`
- `POST /api/v1/workspaces/:workspaceId/invitations/:invitationId/resend`
- `DELETE /api/v1/workspaces/:workspaceId/invitations/:invitationId`
- `GET /api/v1/invitations`
- `POST /api/v1/invitations/:invitationId/accept`
- `POST /api/v1/invitations/:invitationId/decline`

Role yang sah: `owner`, `admin`, `member`.

## Notification API

**Status:** Available. Bearer. Hanya notifikasi milik user yang login.

- `GET /api/v1/notifications` dengan query `limit`, `cursor`, `readStatus`, `type`
- `GET /api/v1/notifications/unread-count` mengembalikan `{ "unreadCount": 0 }`
- `GET /api/v1/notifications/preferences` mengembalikan `{ "preferences": { "inAppEnabled": true, "emailEnabled": false } }`
- `PATCH /api/v1/notifications/preferences` body `{ "emailEnabled": true }`
- `PATCH /api/v1/notifications/read-all` mengembalikan `{ "updated": 0 }`
- `PATCH /api/v1/notifications/:notificationId/read`

Tipe yang ada pada schema route: `reminder_due`, `todo_due_soon`.

Not available: API job queue, WebSocket, dan mematikan kanal in-app.

## Health

**Status:** Available, tanpa autentikasi.

- `GET /health` dan `GET /health/live` mengembalikan `{ "status": "ok" }`.
- `GET /ready` memeriksa database.
