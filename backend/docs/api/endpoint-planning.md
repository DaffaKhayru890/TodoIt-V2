# API — Endpoint Planning

## 1. Cara Membaca

Setiap endpoint didokumentasikan dengan:

- **Tujuan**, **Auth**, **Authz**, **Path/Query**, **Body**, **Response**, **Error**,
  **Validasi**.

Konvensi umum (envelope, status, error format) ada di
[`api-overview.md`](api-overview.md), [`response-convention.md`](response-convention.md), dan
[`error-convention.md`](error-convention.md).

Error umum yang berlaku di semua endpoint privat dan tidak diulang:

| Status | Code | Kapan |
|---|---|---|
| 401 | `UNAUTHENTICATED` | Header/token tidak ada |
| 401 | `INVALID_TOKEN` | Token rusak/signature salah |
| 401 | `TOKEN_EXPIRED` | Access token kedaluwarsa |
| 401 | `SESSION_REVOKED` | Session dicabut |
| 500 | `INTERNAL_ERROR` | Error tak terduga |
| 429 | `TOO_MANY_REQUESTS` | Rate limit (login/refresh) |

Error otorisasi workspace yang berulang:

| Status | Code | Kapan |
|---|---|---|
| 404 | `WORKSPACE_NOT_FOUND` | Workspace tidak ada, terhapus, atau user bukan member |
| 403 | `FORBIDDEN` | Member tetapi role tidak cukup |
| 404 | `RESOURCE_NOT_FOUND` | Resource tidak ada di workspace tersebut |

---

## 2. Authentication

### 2.1 `POST /api/v1/auth/register`

| Aspek | Detail |
|---|---|
| Tujuan | Membuat akun baru |
| Auth | Publik |
| Authz | — |
| Body | `name`, `email`, `password`, `timezone` (opsional) |

Request:

```json
{
  "name": "Daffa",
  "email": "daffa@example.com",
  "password": "rahasia123",
  "timezone": "Asia/Jakarta"
}
```

Response **201**:

```json
{
  "success": true,
  "message": "User registered successfully",
  "data": {
    "id": "019a...",
    "name": "Daffa",
    "email": "daffa@example.com",
    "timezone": "Asia/Jakarta",
    "created_at": "2026-11-12T10:00:00Z"
  }
}
```

| Error | Code |
|---|---|
| 409 | `EMAIL_ALREADY_USED` |
| 422 | `VALIDATION_ERROR` |

Validasi:

- `name`: wajib, 1–100 char setelah trim.
- `email`: wajib, format email, maks 254, dinormalisasi lowercase.
- `password`: wajib, 8–72 byte, mengandung huruf dan angka.
- `timezone`: opsional, IANA valid, default `UTC`.
- Body tidak boleh memuat field lain (`role`, `id`) — diabaikan; tidak memengaruhi.

### 2.2 `POST /api/v1/auth/login`

| Aspek | Detail |
|---|---|
| Tujuan | Menukar kredensial dengan token |
| Auth | Publik + rate limit |
| Body | `email`, `password` |

Response **200**:

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "8f3a...",
    "token_type": "Bearer",
    "expires_in": 900,
    "user": {
      "id": "019a...",
      "name": "Daffa",
      "email": "daffa@example.com",
      "timezone": "Asia/Jakarta"
    }
  }
}
```

| Error | Code |
|---|---|
| 401 | `INVALID_CREDENTIALS` |
| 422 | `VALIDATION_ERROR` |
| 429 | `TOO_MANY_REQUESTS` (+ `Retry-After`) |

Validasi: `email` format valid; `password` tidak kosong. Pesan error tidak membedakan email
tidak ada vs password salah.

### 2.3 `POST /api/v1/auth/refresh`

| Aspek | Detail |
|---|---|
| Tujuan | Menukar refresh token dengan pasangan token baru (rotasi) |
| Auth | Publik (memakai refresh token) |
| Body | `refresh_token` |

Response **200**: sama dengan login tanpa `user`:

```json
{
  "success": true,
  "message": "Token refreshed successfully",
  "data": {
    "access_token": "eyJ...",
    "refresh_token": "9c1b...",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

| Error | Code |
|---|---|
| 401 | `INVALID_REFRESH_TOKEN` |
| 401 | `REFRESH_TOKEN_EXPIRED` |
| 401 | `REFRESH_TOKEN_REUSED` |
| 429 | `TOO_MANY_REQUESTS` |

Validasi: token wajib, panjang wajar (≤ 512 char). Client wajib menyimpan refresh token baru.

### 2.4 `POST /api/v1/auth/logout`

| Aspek | Detail |
|---|---|
| Tujuan | Mencabut session saat ini |
| Auth | Bearer |
| Authz | Pemilik session |
| Body | — |

Response **204** tanpa body. Idempoten.

| Error | Code |
|---|---|
| 401 | `UNAUTHENTICATED` / `INVALID_TOKEN` / `SESSION_REVOKED` |

### 2.5 `POST /api/v1/auth/logout-all`

| Aspek | Detail |
|---|---|
| Tujuan | Mencabut seluruh session user |
| Auth | Bearer |
| Authz | User sendiri |
| Body | — |

Response **204**. Idempoten.

| Error | Code |
|---|---|
| 401 | standar auth |

### 2.6 `GET /api/v1/auth/me`

| Aspek | Detail |
|---|---|
| Tujuan | Identitas user + session aktif |
| Auth | Bearer |
| Query | — |

Response **200**:

```json
{
  "success": true,
  "message": "Current user retrieved successfully",
  "data": {
    "id": "019a...",
    "name": "Daffa",
    "email": "daffa@example.com",
    "timezone": "Asia/Jakarta",
    "session": {
      "id": "019b...",
      "issued_at": "2026-11-12T10:00:00Z",
      "expires_at": "2026-12-12T10:00:00Z",
      "user_agent": "Mozilla/5.0",
      "ip_address": "203.0.113.10"
    }
  }
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `USER_NOT_FOUND` (user dihapus setelah token terbit) |

---

## 3. Users

### 3.1 `GET /api/v1/users/me`

| Aspek | Detail |
|---|---|
| Tujuan | Profil lengkap user |
| Auth | Bearer |
| Query | — |

Response **200**:

```json
{
  "success": true,
  "message": "Profile retrieved successfully",
  "data": {
    "id": "019a...",
    "name": "Daffa",
    "email": "daffa@example.com",
    "timezone": "Asia/Jakarta",
    "created_at": "2026-11-01T08:00:00Z",
    "updated_at": "2026-11-12T10:00:00Z"
  }
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `USER_NOT_FOUND` |

### 3.2 `PATCH /api/v1/users/me`

| Aspek | Detail |
|---|---|
| Tujuan | Update nama dan/atau timezone |
| Auth | Bearer |
| Body | `name` (opsional), `timezone` (opsional) |

Request:

```json
{"name": "Daffa K.", "timezone": "Asia/Singapore"}
```

Response **200**: profil terbaru (bentuk sama dengan GET).

| Error | Code |
|---|---|
| 401 | standar auth |
| 422 | `VALIDATION_ERROR` (timezone invalid, body kosong) |

Validasi:

- Minimal satu field dikirim.
- `name`: 1–100 char.
- `timezone`: IANA valid, bukan `Local`.
- `email` tidak dapat diubah (field diabaikan/ditolak 422 jika dikirim — **keputusan:
  ditolak 422** agar client tidak mengira berhasil).

---

## 4. Workspaces

### 4.1 `POST /api/v1/workspaces`

| Aspek | Detail |
|---|---|
| Tujuan | Membuat workspace + owner membership |
| Auth | Bearer |
| Body | `name`, `description` (opsional) |

Request:

```json
{"name": "Product Team", "description": "Workspace untuk tim produk"}
```

Response **201**:

```json
{
  "success": true,
  "message": "Workspace created successfully",
  "data": {
    "id": "019c...",
    "name": "Product Team",
    "description": "Workspace untuk tim produk",
    "owner_id": "019a...",
    "role": "OWNER",
    "created_at": "2026-11-12T10:00:00Z",
    "updated_at": "2026-11-12T10:00:00Z"
  }
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 422 | `VALIDATION_ERROR` |

Validasi: `name` 1–100; `description` ≤ 1000; `owner_id` tidak diterima dari body.

### 4.2 `GET /api/v1/workspaces`

| Aspek | Detail |
|---|---|
| Tujuan | List workspace tempat user menjadi member |
| Auth | Bearer |
| Query | `limit`, `cursor` |

Response **200**:

```json
{
  "success": true,
  "message": "Workspaces retrieved successfully",
  "data": [
    {
      "id": "019c...",
      "name": "Product Team",
      "description": "…",
      "owner_id": "019a...",
      "role": "OWNER",
      "member_count": 3,
      "created_at": "2026-11-12T10:00:00Z"
    }
  ],
  "pagination": {"limit": 20, "next_cursor": null, "has_more": false}
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 422 | `VALIDATION_ERROR` / `INVALID_CURSOR` |

Catatan: `member_count` dihitung dengan subquery terindeks; jika performa menjadi masalah,
tunda field ini (Phase 9).

### 4.3 `GET /api/v1/workspaces/{workspace_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Detail workspace + role user |
| Auth | Bearer |
| Authz | Member |
| Path | `workspace_id` UUID |

Response **200**: objek workspace dengan `role` user, `member_count`, dan `created_at`.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` (UUID invalid) |

### 4.4 `PATCH /api/v1/workspaces/{workspace_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Update nama/deskripsi |
| Auth | Bearer |
| Authz | OWNER, ADMIN |
| Body | `name` (opsional), `description` (opsional) |

Response **200**: workspace terbaru.

| Error | Code |
|---|---|
| 401 | standar auth |
| 403 | `FORBIDDEN` |
| 404 | `WORKSPACE_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` |

Validasi: minimal satu field; `name` 1–100; `description` ≤ 1000; `owner_id` ditolak 422.

### 4.5 `DELETE /api/v1/workspaces/{workspace_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Soft delete workspace |
| Auth | Bearer |
| Authz | OWNER |
| Body | — |

Response **204**.

| Error | Code |
|---|---|
| 401 | standar auth |
| 403 | `FORBIDDEN` |
| 404 | `WORKSPACE_NOT_FOUND` |

Perilaku: workspace hilang dari list; semua akses berikutnya 404. Task tidak dihapus massal.
Reminder `PENDING`/`FAILED` milik workspace di-`CANCELLED` dalam transaksi yang sama.

---

## 5. Workspace Members

### 5.1 `GET /api/v1/workspaces/{workspace_id}/members`

| Aspek | Detail |
|---|---|
| Tujuan | List member workspace |
| Auth | Bearer |
| Authz | Member |
| Query | `limit`, `cursor`, `role` (opsional) |

Response **200**:

```json
{
  "success": true,
  "message": "Members retrieved successfully",
  "data": [
    {
      "user_id": "019a...",
      "name": "Daffa",
      "email": "daffa@example.com",
      "role": "OWNER",
      "joined_at": "2026-11-12T10:00:00Z"
    }
  ],
  "pagination": {"limit": 20, "next_cursor": null, "has_more": false}
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` (role invalid) |

### 5.2 `PATCH /api/v1/workspaces/{workspace_id}/members/{user_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Ubah role member |
| Auth | Bearer |
| Authz | OWNER; ADMIN hanya untuk MEMBER→ADMIN |
| Path | `workspace_id`, `user_id` |
| Body | `role` (`ADMIN` atau `MEMBER`) |

Request: `{"role": "ADMIN"}`

Response **200**:

```json
{
  "success": true,
  "message": "Member role updated successfully",
  "data": {"user_id": "019d...", "role": "ADMIN", "updated_at": "2026-11-12T10:05:00Z"}
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 403 | `FORBIDDEN` |
| 404 | `WORKSPACE_NOT_FOUND` / `MEMBER_NOT_FOUND` |
| 409 | `OWNER_PROTECTED` |
| 422 | `VALIDATION_ERROR` |

Aturan: tidak dapat menjadikan OWNER; tidak dapat mengubah OWNER; ADMIN tidak dapat
mengubah ADMIN lain.

### 5.3 `DELETE /api/v1/workspaces/{workspace_id}/members/{user_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Hapus member / leave workspace |
| Auth | Bearer |
| Authz | OWNER/ADMIN untuk member lain; MEMBER untuk diri sendiri |
| Path | `workspace_id`, `user_id` |

Response **204**.

| Error | Code |
|---|---|
| 401 | standar auth |
| 403 | `FORBIDDEN` |
| 404 | `WORKSPACE_NOT_FOUND` / `MEMBER_NOT_FOUND` |
| 409 | `OWNER_PROTECTED` |

Aturan: OWNER tidak dapat dihapus; ADMIN tidak dapat menghapus ADMIN; MEMBER hanya dapat
menghapus dirinya.

---

## 6. Invitations

### 6.1 `POST /api/v1/workspaces/{workspace_id}/invitations`

| Aspek | Detail |
|---|---|
| Tujuan | Mengundang email ke workspace |
| Auth | Bearer |
| Authz | OWNER (role ADMIN/MEMBER); ADMIN (role MEMBER saja) |
| Body | `email`, `role` (opsional, default `MEMBER`) |

Request:

```json
{"email": "friend@example.com", "role": "MEMBER"}
```

Response **201**:

```json
{
  "success": true,
  "message": "Invitation sent successfully",
  "data": {
    "id": "019e...",
    "email": "friend@example.com",
    "role": "MEMBER",
    "status": "PENDING",
    "expires_at": "2026-11-19T10:00:00Z",
    "email_delivery_status": "SENT",
    "created_at": "2026-11-12T10:00:00Z"
  }
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 403 | `FORBIDDEN` |
| 404 | `WORKSPACE_NOT_FOUND` |
| 409 | `ALREADY_MEMBER` / `INVITATION_ALREADY_PENDING` |
| 422 | `VALIDATION_ERROR` (email invalid, role invalid) |

Validasi: email format valid; role hanya `ADMIN`/`MEMBER`; user belum member.

Catatan: jika pengiriman email gagal, response tetap 201 dengan
`email_delivery_status: "FAILED"`.

### 6.2 `GET /api/v1/workspaces/{workspace_id}/invitations`

| Aspek | Detail |
|---|---|
| Tujuan | List undangan workspace |
| Auth | Bearer |
| Authz | Member |
| Query | `limit`, `cursor`, `status` (opsional) |

Response **200**: list undangan + pagination.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` (status invalid, cursor invalid) |

### 6.3 `DELETE /api/v1/workspaces/{workspace_id}/invitations/{invitation_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Membatalkan undangan PENDING |
| Auth | Bearer |
| Authz | OWNER, ADMIN |
| Path | `workspace_id`, `invitation_id` |

Response **204**.

| Error | Code |
|---|---|
| 401 | standar auth |
| 403 | `FORBIDDEN` |
| 404 | `WORKSPACE_NOT_FOUND` / `INVITATION_NOT_FOUND` |
| 409 | `INVITATION_NOT_PENDING` |

### 6.4 `POST /api/v1/invitations/accept` (utama)

| Aspek | Detail |
|---|---|
| Tujuan | Menerima undangan |
| Auth | Bearer |
| Authz | Email user harus sama dengan email undangan |
| Body | `token` |
| Alias | `POST /api/v1/invitations/{token}/accept` (tanpa body) |

Request:

```json
{"token": "raw-invitation-token"}
```

Response **200**:

```json
{
  "success": true,
  "message": "Invitation accepted successfully",
  "data": {
    "workspace_id": "019c...",
    "workspace_name": "Product Team",
    "role": "MEMBER",
    "joined_at": "2026-11-12T10:10:00Z"
  }
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 403 | `INVITATION_EMAIL_MISMATCH` |
| 404 | `INVITATION_NOT_FOUND` |
| 409 | `INVITATION_NOT_PENDING` / `ALREADY_MEMBER` |
| 410 | `INVITATION_EXPIRED` |
| 422 | `VALIDATION_ERROR` |

Aturan: token di-hash lalu dicari; status harus PENDING; email harus cocok; membership
dibuat dalam transaksi.

---

## 7. Tasks

### 7.1 `POST /api/v1/workspaces/{workspace_id}/tasks`

| Aspek | Detail |
|---|---|
| Tujuan | Membuat task |
| Auth | Bearer |
| Authz | Member |
| Body | `title`, `description?`, `status?`, `priority?`, `due_at?`, `assignee_id?`, `tag_ids?`, `label_ids?` |

Request:

```json
{
  "title": "Tulis dokumentasi API",
  "description": "Lengkapi OpenAPI",
  "status": "TODO",
  "priority": "HIGH",
  "due_at": "2026-11-15T17:00:00+07:00",
  "assignee_id": "019d...",
  "tag_ids": ["019f..."],
  "label_ids": ["01a0..."]
}
```

Response **201**:

```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {
    "id": "01a1...",
    "workspace_id": "019c...",
    "title": "Tulis dokumentasi API",
    "description": "Lengkapi OpenAPI",
    "status": "TODO",
    "priority": "HIGH",
    "due_at": "2026-11-15T10:00:00Z",
    "completed_at": null,
    "created_by": "019a...",
    "assignee_id": "019d...",
    "tags": [{"id": "019f...", "name": "docs"}],
    "labels": [{"id": "01a0...", "name": "Feature", "color": "#3B82F6"}],
    "created_at": "2026-11-12T10:00:00Z",
    "updated_at": "2026-11-12T10:00:00Z"
  }
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` / `ASSIGNEE_NOT_MEMBER` / `INVALID_TAG` / `INVALID_LABEL` |

Validasi:

- `title` 1–200; `description` ≤ 10.000.
- `status` enum; default `TODO`. Jika `DONE` dikirim saat create, `completed_at` diisi now.
- `priority` enum; default `MEDIUM`.
- `due_at` RFC3339 dengan offset.
- `assignee_id` harus member.
- `tag_ids`/`label_ids` maks 50, unik, milik workspace.

### 7.2 `GET /api/v1/workspaces/{workspace_id}/tasks`

| Aspek | Detail |
|---|---|
| Tujuan | List task dengan filter, sort, cursor |
| Auth | Bearer |
| Authz | Member |
| Query | lihat tabel di bawah |

| Query | Tipe | Default | Validasi |
|---|---|---|---|
| `limit` | int | 20 | 1–100 |
| `cursor` | string | — | signature valid, filter cocok |
| `status` | CSV | semua | subset enum |
| `priority` | CSV | semua | subset enum |
| `assignee_id` | UUID/`me`/`none` | semua | UUID valid |
| `tag_ids` | CSV UUID | — | maks 50 |
| `label_ids` | CSV UUID | — | maks 50 |
| `due_from` | RFC3339 | — | offset wajib |
| `due_to` | RFC3339 | — | ≥ due_from |
| `q` | string | — | ≤ 100 |
| `include_completed` | bool | `true` | |
| `sort` | enum | `created_at` | `created_at`,`updated_at`,`due_at`,`priority`,`title` |
| `order` | enum | `desc` | `asc`,`desc` |

Response **200**:

```json
{
  "success": true,
  "message": "Tasks retrieved successfully",
  "data": [],
  "pagination": {"limit": 20, "next_cursor": null, "has_more": false}
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` / `INVALID_CURSOR` / `INVALID_FILTER` |

### 7.3 `GET /api/v1/workspaces/{workspace_id}/tasks/{task_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Detail task |
| Auth | Bearer |
| Authz | Member |
| Path | `workspace_id`, `task_id` |

Response **200**: objek task lengkap (tags, labels, assignee ringkas).

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` / `RESOURCE_NOT_FOUND` |

### 7.4 `PATCH /api/v1/workspaces/{workspace_id}/tasks/{task_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Update sebagian task |
| Auth | Bearer |
| Authz | Member |
| Body | Field opsional: `title`, `description`, `status`, `priority`, `due_at`, `assignee_id`, `tag_ids`, `label_ids` |

Response **200**: task terbaru.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` / `RESOURCE_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` / `ASSIGNEE_NOT_MEMBER` / `INVALID_TAG` / `INVALID_LABEL` |
| 409 | `INVALID_STATUS_TRANSITION` (jika transisi tidak diizinkan) |

Semantik:

- `due_at: null` menghapus due date.
- `assignee_id: null` menghapus assignee.
- `tag_ids`/`label_ids` bersifat **replace** (bukan append). Array kosong menghapus semua.
- Update `status` ke `DONE` mengisi `completed_at`; dari `DONE` ke status lain mengosongkannya.
- `created_by`, `workspace_id`, `id` tidak dapat diubah.

### 7.5 `DELETE /api/v1/workspaces/{workspace_id}/tasks/{task_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Soft delete task |
| Auth | Bearer |
| Authz | Member |

Response **204**.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` / `RESOURCE_NOT_FOUND` |

Efek: reminder PENDING → `CANCELLED`; pivot dipertahankan untuk restore.

### 7.6 `POST /api/v1/workspaces/{workspace_id}/tasks/{task_id}/complete`

| Aspek | Detail |
|---|---|
| Tujuan | Menandai task selesai |
| Auth | Bearer |
| Authz | Member |
| Body | — |

Response **200**: task dengan `status: "DONE"`, `completed_at` terisi. Idempoten.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` / `RESOURCE_NOT_FOUND` |

### 7.7 `POST /api/v1/workspaces/{workspace_id}/tasks/{task_id}/reopen`

| Aspek | Detail |
|---|---|
| Tujuan | Mengembalikan task ke `TODO` |
| Auth | Bearer |
| Authz | Member |
| Body | — |

Response **200**: `status: "TODO"`, `completed_at: null`. Idempoten.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` / `RESOURCE_NOT_FOUND` |

---

## 8. Task Views

Ketiga endpoint memakai path `/views/...` (lihat alasan di `api-overview.md` §13).

### 8.1 `GET /api/v1/workspaces/{workspace_id}/tasks/views/today`

| Aspek | Detail |
|---|---|
| Tujuan | Task due hari ini menurut timezone user |
| Auth | Bearer |
| Authz | Member |
| Query | `limit`, `cursor`, `status`, `priority`, `assignee_id`, `tag_ids`, `label_ids`, `q` |

Response **200**:

```json
{
  "success": true,
  "message": "Today tasks retrieved successfully",
  "data": [],
  "pagination": {"limit": 20, "next_cursor": null, "has_more": false},
  "meta": {
    "timezone": "Asia/Jakarta",
    "date": "2026-11-12",
    "range_start": "2026-11-11T17:00:00Z",
    "range_end": "2026-11-12T17:00:00Z"
  }
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` / `INVALID_CURSOR` |

Aturan: `status <> 'DONE'`; sort `due_at ASC, id ASC`.

### 8.2 `GET /api/v1/workspaces/{workspace_id}/tasks/views/upcoming`

| Aspek | Detail |
|---|---|
| Tujuan | Task dalam N hari ke depan |
| Auth | Bearer |
| Authz | Member |
| Query | sama + `days` (opsional, 1–30, default env) |

Response **200**:

```json
{
  "success": true,
  "message": "Upcoming tasks retrieved successfully",
  "data": [],
  "pagination": {"limit": 20, "next_cursor": null, "has_more": false},
  "meta": {
    "timezone": "Asia/Jakarta",
    "date": "2026-11-12",
    "range_start": "2026-11-12T17:00:00Z",
    "range_end": "2026-11-18T17:00:00Z",
    "days": 7
  }
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` |

### 8.3 `GET /api/v1/workspaces/{workspace_id}/tasks/views/overdue`

| Aspek | Detail |
|---|---|
| Tujuan | Task lewat due date dan belum selesai |
| Auth | Bearer |
| Authz | Member |
| Query | `limit`, `cursor`, filter subset |

Response **200**: list + pagination + `meta` (timezone, `as_of`).

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` |

---

## 9. Tags

### 9.1 `POST /api/v1/workspaces/{workspace_id}/tags`

| Aspek | Detail |
|---|---|
| Tujuan | Membuat tag |
| Auth | Bearer |
| Authz | Member |
| Body | `name` |

Response **201**:

```json
{"success":true,"message":"Tag created successfully","data":{"id":"019f...","workspace_id":"019c...","name":"backend","created_at":"2026-11-12T10:00:00Z"}}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` |
| 409 | `TAG_ALREADY_EXISTS` |
| 422 | `VALIDATION_ERROR` |

Validasi: `name` 1–50, trim, collapse spasi; unik case-insensitive per workspace.

### 9.2 `GET /api/v1/workspaces/{workspace_id}/tags`

| Aspek | Detail |
|---|---|
| Tujuan | List tag |
| Auth | Bearer |
| Authz | Member |
| Query | `limit`, `cursor`, `q` (opsional) |

Response **200**: list tag + pagination.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` |

### 9.3 `PATCH /api/v1/workspaces/{workspace_id}/tags/{tag_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Rename tag |
| Auth | Bearer |
| Authz | Member |
| Body | `name` |

Response **200**: tag terbaru.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` / `RESOURCE_NOT_FOUND` |
| 409 | `TAG_ALREADY_EXISTS` |
| 422 | `VALIDATION_ERROR` |

### 9.4 `DELETE /api/v1/workspaces/{workspace_id}/tags/{tag_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Hapus tag |
| Auth | Bearer |
| Authz | Member |

Response **204**. Pivot ikut terhapus.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` / `RESOURCE_NOT_FOUND` |

---

## 10. Labels

### 10.1 `POST /api/v1/workspaces/{workspace_id}/labels`

| Aspek | Detail |
|---|---|
| Tujuan | Membuat label |
| Auth | Bearer |
| Authz | Member |
| Body | `name`, `color` |

Response **201**:

```json
{"success":true,"message":"Label created successfully","data":{"id":"01a0...","workspace_id":"019c...","name":"Bug","color":"#EF4444","created_at":"2026-11-12T10:00:00Z"}}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` |
| 409 | `LABEL_ALREADY_EXISTS` |
| 422 | `VALIDATION_ERROR` |

Validasi: `name` 1–50; `color` wajib `#RRGGBB`.

### 10.2 `GET /api/v1/workspaces/{workspace_id}/labels`

| Aspek | Detail |
|---|---|
| Tujuan | List label |
| Auth | Bearer |
| Authz | Member |
| Query | `limit`, `cursor`, `q` |

Response **200**: list label + pagination.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` |

### 10.3 `PATCH /api/v1/workspaces/{workspace_id}/labels/{label_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Update nama/warna |
| Auth | Bearer |
| Authz | Member |
| Body | `name?`, `color?` |

Response **200**: label terbaru.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` / `RESOURCE_NOT_FOUND` |
| 409 | `LABEL_ALREADY_EXISTS` |
| 422 | `VALIDATION_ERROR` |

### 10.4 `DELETE /api/v1/workspaces/{workspace_id}/labels/{label_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Hapus label |
| Auth | Bearer |
| Authz | Member |

Response **204**. Pivot ikut terhapus.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` / `RESOURCE_NOT_FOUND` |

---

## 11. Reminders

### 11.1 `POST /api/v1/workspaces/{workspace_id}/tasks/{task_id}/reminders`

| Aspek | Detail |
|---|---|
| Tujuan | Membuat reminder |
| Auth | Bearer |
| Authz | Member |
| Body | `scheduled_at` |

Request:

```json
{"scheduled_at": "2026-11-14T09:00:00+07:00"}
```

Response **201**:

```json
{
  "success": true,
  "message": "Reminder created successfully",
  "data": {
    "id": "01a2...",
    "task_id": "01a1...",
    "user_id": "019a...",
    "scheduled_at": "2026-11-14T02:00:00Z",
    "status": "PENDING",
    "created_at": "2026-11-12T10:00:00Z"
  }
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` / `RESOURCE_NOT_FOUND` |
| 422 | `VALIDATION_ERROR` / `REMINDER_IN_PAST` / `REMINDER_LIMIT_EXCEEDED` |

Validasi: `scheduled_at` RFC3339 dengan offset, > now + 1 menit; maks 5 PENDING per task.

### 11.2 `GET /api/v1/workspaces/{workspace_id}/tasks/{task_id}/reminders`

| Aspek | Detail |
|---|---|
| Tujuan | List reminder task |
| Auth | Bearer |
| Authz | Member |
| Query | `limit`, `cursor` |

Response **200**: list reminder + pagination; urut `scheduled_at ASC`.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` / `RESOURCE_NOT_FOUND` |

### 11.3 `PATCH /api/v1/workspaces/{workspace_id}/tasks/{task_id}/reminders/{reminder_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Ubah jadwal reminder |
| Auth | Bearer |
| Authz | Member |
| Body | `scheduled_at` |

Response **200**: reminder terbaru.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` / `RESOURCE_NOT_FOUND` |
| 409 | `REMINDER_NOT_EDITABLE` (SENT/CANCELLED) |
| 422 | `VALIDATION_ERROR` / `REMINDER_IN_PAST` |

### 11.4 `DELETE /api/v1/workspaces/{workspace_id}/tasks/{task_id}/reminders/{reminder_id}`

| Aspek | Detail |
|---|---|
| Tujuan | Hapus reminder PENDING/FAILED |
| Auth | Bearer |
| Authz | Member |

Response **204**.

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `WORKSPACE_NOT_FOUND` / `RESOURCE_NOT_FOUND` |
| 409 | `REMINDER_NOT_DELETABLE` (SENT) |

---

## 12. Notifications

### 12.1 `GET /api/v1/notifications`

| Aspek | Detail |
|---|---|
| Tujuan | Inbox notifikasi user |
| Auth | Bearer |
| Authz | Pemilik notifikasi |
| Query | `limit`, `cursor`, `unread` (bool), `workspace_id`, `type` |

Response **200**:

```json
{
  "success": true,
  "message": "Notifications retrieved successfully",
  "data": [
    {
      "id": "01a3...",
      "type": "REMINDER",
      "title": "Reminder: Tulis dokumentasi API",
      "message": "Your task is due at 15 Nov 2026 17:00.",
      "workspace_id": "019c...",
      "task_id": "01a1...",
      "read_at": null,
      "created_at": "2026-11-14T02:00:00Z"
    }
  ],
  "pagination": {"limit": 20, "next_cursor": null, "has_more": false}
}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 422 | `VALIDATION_ERROR` / `INVALID_CURSOR` |

### 12.2 `PATCH /api/v1/notifications/{notification_id}/read`

| Aspek | Detail |
|---|---|
| Tujuan | Tandai satu notifikasi dibaca |
| Auth | Bearer |
| Authz | Pemilik |
| Body | — |

Response **200**:

```json
{"success":true,"message":"Notification marked as read","data":{"id":"01a3...","read_at":"2026-11-12T10:05:00Z"}}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 404 | `NOTIFICATION_NOT_FOUND` |

Idempoten: jika sudah read, tetap 200 dengan `read_at` lama.

### 12.3 `POST /api/v1/notifications/read-all`

| Aspek | Detail |
|---|---|
| Tujuan | Tandai semua notifikasi dibaca |
| Auth | Bearer |
| Authz | Pemilik |
| Body | `workspace_id?` (opsional, mempersempit) |

Response **200**:

```json
{"success":true,"message":"All notifications marked as read","data":{"updated":12}}
```

| Error | Code |
|---|---|
| 401 | standar auth |
| 422 | `VALIDATION_ERROR` (workspace_id invalid) |

---

## 13. Health

### 13.1 `GET /health`

| Aspek | Detail |
|---|---|
| Tujuan | Liveness |
| Auth | Publik |
| Response 200 | `{"success":true,"message":"OK","data":{"status":"ok","version":"0.1.0"}}` |
| Error | — |

### 13.2 `GET /ready`

| Aspek | Detail |
|---|---|
| Tujuan | Readiness (database) |
| Auth | Publik |
| Response 200 | `{"success":true,"message":"Ready","data":{"status":"ready","checks":{"database":"ok"}}}` |
| Response 503 | `{"success":false,"error":{"code":"NOT_READY","message":"Service is not ready","details":{"database":"failed"}}}` |

---

## 14. Matriks Endpoint → Test Wajib

| Endpoint | Unit | Integration |
|---|---|---|
| register | validator, password policy | unique email, hash tersimpan |
| login | timing equalizer | token valid, session dibuat |
| refresh | rotasi, reuse | family revoked |
| logout/logout-all | revocation | session tidak dapat dipakai |
| auth/me | — | session info |
| users/me GET/PATCH | timezone validation | update tersimpan |
| workspace CRUD | permission | owner membership dibuat |
| members | role rules | isolasi workspace |
| invitations | token/expiry | accept flow, duplicate |
| tasks CRUD | validation, status transition | workspace scope, pivot |
| complete/reopen | idempotensi | completed_at |
| views | timezone range | due filter |
| tags/labels | uniqueness | cascade pivot |
| reminders | time validation | worker claim |
| notifications | dedupe | cursor inbox |
| health/ready | — | DB down → 503 |

Setiap endpoint **wajib** memiliki minimal satu test controller dan satu test service.
