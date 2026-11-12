# API — Error Convention

## 1. Prinsip

1. **Error selalu memiliki `code` yang stabil** dan dapat diprogram client.
2. **Pesan manusiawi** tidak dipakai untuk logika client.
3. **Tidak membocorkan detail internal** (SQL, stack trace, path file, token).
4. **Status HTTP konsisten** dengan jenis kesalahan.
5. **Validasi mengembalikan semua field yang salah** dalam satu response, bukan satu per
   request.
6. **`request_id` selalu ada** pada error 500 untuk korelasi log.

## 2. Envelope Error

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": {
        "title": "must be between 1 and 200 characters",
        "due_at": "must be a valid RFC3339 timestamp with timezone"
      }
    },
    "request_id": "a1b2c3d4-..."
  }
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `success` | boolean | Ya | Selalu `false` |
| `error.code` | string | Ya | UPPER_SNAKE_CASE, stabil |
| `error.message` | string | Ya | Ringkasan, bahasa Inggris |
| `error.details` | object | Tidak | Konteks tambahan |
| `error.request_id` | string | Ya (500), opsional (4xx) | ID request |

Tidak ada field `data` pada error. Tidak ada `error` berupa string.

## 3. Format `details`

### 3.1 Validasi Field

```json
"details": {
  "fields": {
    "email": "must be a valid email address",
    "password": "must be at least 8 characters"
  }
}
```

- Key = nama field request (snake_case).
- Value = pesan spesifik.
- Jika satu field punya beberapa kesalahan, gabungkan dengan `; ` atau kembalikan yang
  pertama. **Keputusan:** pesan pertama yang paling relevan (menghindari response besar).
- Field yang tidak dikenal tidak dimasukkan; gunakan `INVALID_FIELD` jika strict.

### 3.2 Konflik Resource

```json
"details": {"field": "email", "value": "daffa@example.com"}
```

Jangan mengembalikan nilai sensitif (password, token).

### 3.3 Invitation

```json
"details": {"status": "PENDING", "expires_at": "2026-11-19T10:00:00Z"}
```

## 4. Pemetaan Status HTTP

| Status | Kategori | Contoh Code |
|---|---|---|
| 400 | Request tidak dapat diparse | `MALFORMED_JSON`, `INVALID_QUERY_PARAM` |
| 401 | Belum terautentikasi | `UNAUTHENTICATED`, `INVALID_TOKEN`, `TOKEN_EXPIRED`, `INVALID_CREDENTIALS` |
| 403 | Terautentikasi tetapi tidak berhak | `FORBIDDEN`, `INVITATION_EMAIL_MISMATCH` |
| 404 | Resource tidak ditemukan / disembunyikan | `WORKSPACE_NOT_FOUND`, `RESOURCE_NOT_FOUND`, `NOTIFICATION_NOT_FOUND` |
| 405 | Method tidak didukung | `METHOD_NOT_ALLOWED` |
| 409 | Konflik state/duplikat | `EMAIL_ALREADY_USED`, `ALREADY_MEMBER`, `OWNER_PROTECTED` |
| 410 | Resource pernah ada, sudah tidak berlaku | `INVITATION_EXPIRED` |
| 413 | Body terlalu besar | `PAYLOAD_TOO_LARGE` |
| 422 | Semantik/validasi gagal | `VALIDATION_ERROR`, `INVALID_CURSOR`, `ASSIGNEE_NOT_MEMBER` |
| 429 | Rate limit | `TOO_MANY_REQUESTS` |
| 500 | Bug/error tak terduga | `INTERNAL_ERROR` |
| 503 | Dependency tidak siap | `NOT_READY` |

### Mengapa 404 untuk Non-Member

Workspace yang tidak diikuti user diperlakukan seolah tidak ada. Ini mencegah enumerasi ID.
Untuk member dengan role kurang, gunakan 403.

### Mengapa 422 untuk Validasi

JSON valid secara sintaks, tetapi nilainya tidak dapat diproses (mis. enum salah, referensi
tidak ada di workspace). 400 hanya untuk request yang tidak dapat diparse.

## 5. Daftar Error Code

### 5.1 Autentikasi

| Code | HTTP | Pesan | Kapan |
|---|---|---|---|
| `UNAUTHENTICATED` | 401 | Authentication required | Header Authorization tidak ada |
| `INVALID_TOKEN` | 401 | Invalid access token | Signature/format/claims salah |
| `TOKEN_EXPIRED` | 401 | Access token expired | `exp` lewat |
| `SESSION_REVOKED` | 401 | Session has been revoked | `sid` tidak aktif |
| `INVALID_CREDENTIALS` | 401 | Invalid email or password | Login gagal |
| `INVALID_REFRESH_TOKEN` | 401 | Invalid refresh token | Hash tidak ditemukan |
| `REFRESH_TOKEN_EXPIRED` | 401 | Refresh token expired | `expires_at` lewat |
| `REFRESH_TOKEN_REUSED` | 401 | Refresh token reuse detected | Token lama dipakai lagi |
| `EMAIL_ALREADY_USED` | 409 | Email is already registered | Register duplikat |
| `TOO_MANY_REQUESTS` | 429 | Too many requests | Rate limit |

### 5.2 User

| Code | HTTP | Pesan | Kapan |
|---|---|---|---|
| `USER_NOT_FOUND` | 404 | User not found | User dihapus/tidak ada |
| `INVALID_TIMEZONE` | 422 | Invalid timezone | IANA tidak valid |

`INVALID_TIMEZONE` biasanya dibungkus `VALIDATION_ERROR` dengan `details.fields.timezone`.
Code terpisah disediakan untuk client yang ingin menampilkan pesan khusus.

### 5.3 Workspace & Membership

| Code | HTTP | Pesan | Kapan |
|---|---|---|---|
| `WORKSPACE_NOT_FOUND` | 404 | Workspace not found | Tidak ada/terhapus/bukan member |
| `MEMBER_NOT_FOUND` | 404 | Member not found | User bukan member |
| `FORBIDDEN` | 403 | You do not have permission to perform this action | Role kurang |
| `OWNER_PROTECTED` | 409 | Workspace owner cannot be removed or demoted | Remove/demote owner |
| `LAST_OWNER` | 409 | Workspace must have an owner | Operasi meninggalkan tanpa owner |
| `ALREADY_MEMBER` | 409 | User is already a member | Accept/invite duplikat |
| `ROLE_ESCALATION_FORBIDDEN` | 403 | Role escalation is not allowed | ADMIN → ADMIN/OWNER |

### 5.4 Invitation

| Code | HTTP | Pesan | Kapan |
|---|---|---|---|
| `INVITATION_NOT_FOUND` | 404 | Invitation not found | Token/hash tidak ada |
| `INVITATION_NOT_PENDING` | 409 | Invitation is no longer pending | Sudah ACCEPTED/CANCELLED |
| `INVITATION_EXPIRED` | 410 | Invitation has expired | `expires_at` lewat |
| `INVITATION_EMAIL_MISMATCH` | 403 | Invitation was issued to a different email | Email tidak cocok |
| `INVITATION_ALREADY_PENDING` | 409 | An invitation is already pending for this email | Duplikat |

### 5.5 Task

| Code | HTTP | Pesan | Kapan |
|---|---|---|---|
| `RESOURCE_NOT_FOUND` | 404 | Resource not found | Task/tag/label/reminder tidak ada di workspace |
| `ASSIGNEE_NOT_MEMBER` | 422 | Assignee must be a workspace member | Assignee invalid |
| `INVALID_TAG` | 422 | One or more tags are invalid for this workspace | Tag lintas workspace/tidak ada |
| `INVALID_LABEL` | 422 | One or more labels are invalid for this workspace | Label lintas workspace |
| `INVALID_STATUS_TRANSITION` | 409 | Status transition is not allowed | Transisi tidak valid |
| `INVALID_FILTER` | 422 | Invalid filter combination | `due_from > due_to`, filter invalid |
| `INVALID_CURSOR` | 422 | Invalid or expired cursor | Signature/format/filter mismatch |
| `TAG_ALREADY_EXISTS` | 409 | Tag already exists in this workspace | Duplikat nama |
| `LABEL_ALREADY_EXISTS` | 409 | Label already exists in this workspace | Duplikat nama |
| `REMINDER_IN_PAST` | 422 | Reminder time must be in the future | `scheduled_at` ≤ now+1m |
| `REMINDER_LIMIT_EXCEEDED` | 422 | Maximum reminders per task exceeded | > 5 PENDING |
| `REMINDER_NOT_EDITABLE` | 409 | Reminder cannot be edited in its current state | SENT/CANCELLED |
| `REMINDER_NOT_DELETABLE` | 409 | Reminder cannot be deleted in its current state | SENT |

### 5.6 Notification

| Code | HTTP | Pesan | Kapan |
|---|---|---|---|
| `NOTIFICATION_NOT_FOUND` | 404 | Notification not found | Bukan milik user/tidak ada |

### 5.7 Umum

| Code | HTTP | Pesan | Kapan |
|---|---|---|---|
| `VALIDATION_ERROR` | 422 | Request validation failed | Field tidak valid |
| `MALFORMED_JSON` | 400 | Malformed JSON body | Body tidak dapat diparse |
| `INVALID_QUERY_PARAM` | 400 | Invalid query parameter | Tipe parameter salah |
| `PAYLOAD_TOO_LARGE` | 413 | Request body is too large | > 1 MB |
| `METHOD_NOT_ALLOWED` | 405 | Method not allowed | Method salah pada path yang ada |
| `ROUTE_NOT_FOUND` | 404 | Route not found | Path tidak terdaftar |
| `CONFLICT` | 409 | Request conflicts with current state | Konflik generik yang tidak punya code khusus |
| `INTERNAL_ERROR` | 500 | Internal server error | Panic/error tak terduga |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable | Timeout internal/overload |
| `NOT_READY` | 503 | Service is not ready | DB down |

## 6. Contoh Response

### 6.1 Validasi

```http
POST /api/v1/workspaces/019c.../tasks
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "fields": {
        "title": "must be between 1 and 200 characters",
        "priority": "must be one of LOW, MEDIUM, HIGH, URGENT"
      }
    },
    "request_id": "a1b2c3d4-..."
  }
}
```

HTTP 422.

### 6.2 Bukan Member

```json
{
  "success": false,
  "error": {
    "code": "WORKSPACE_NOT_FOUND",
    "message": "Workspace not found",
    "request_id": "a1b2c3d4-..."
  }
}
```

HTTP 404.

### 6.3 Role Kurang

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "You do not have permission to perform this action",
    "request_id": "a1b2c3d4-..."
  }
}
```

HTTP 403.

### 6.4 Konflik

```json
{
  "success": false,
  "error": {
    "code": "OWNER_PROTECTED",
    "message": "Workspace owner cannot be removed or demoted",
    "request_id": "a1b2c3d4-..."
  }
}
```

HTTP 409.

### 6.5 Internal

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "Internal server error",
    "request_id": "a1b2c3d4-..."
  }
}
```

HTTP 500. Detail asli hanya di log.

## 7. Pemetaan Error Internal → API

Service mengembalikan error domain (sentinel/wrapped). Handler/error middleware memetakan:

| Error domain | Code | HTTP |
|---|---|---|
| `ErrUnauthenticated` | `UNAUTHENTICATED` | 401 |
| `ErrInvalidToken` | `INVALID_TOKEN` | 401 |
| `ErrTokenExpired` | `TOKEN_EXPIRED` | 401 |
| `ErrSessionRevoked` | `SESSION_REVOKED` | 401 |
| `ErrInvalidCredentials` | `INVALID_CREDENTIALS` | 401 |
| `ErrEmailTaken` | `EMAIL_ALREADY_USED` | 409 |
| `ErrUserNotFound` | `USER_NOT_FOUND` | 404 |
| `ErrWorkspaceNotFound` | `WORKSPACE_NOT_FOUND` | 404 |
| `ErrNotMember` | `WORKSPACE_NOT_FOUND` | 404 |
| `ErrForbidden` | `FORBIDDEN` | 403 |
| `ErrMemberNotFound` | `MEMBER_NOT_FOUND` | 404 |
| `ErrOwnerProtected` | `OWNER_PROTECTED` | 409 |
| `ErrAlreadyMember` | `ALREADY_MEMBER` | 409 |
| `ErrInvitationNotFound` | `INVITATION_NOT_FOUND` | 404 |
| `ErrInvitationNotPending` | `INVITATION_NOT_PENDING` | 409 |
| `ErrInvitationExpired` | `INVITATION_EXPIRED` | 410 |
| `ErrInvitationEmailMismatch` | `INVITATION_EMAIL_MISMATCH` | 403 |
| `ErrResourceNotFound` | `RESOURCE_NOT_FOUND` | 404 |
| `ErrAssigneeNotMember` | `ASSIGNEE_NOT_MEMBER` | 422 |
| `ErrInvalidTag` | `INVALID_TAG` | 422 |
| `ErrInvalidLabel` | `INVALID_LABEL` | 422 |
| `ErrInvalidCursor` | `INVALID_CURSOR` | 422 |
| `ErrValidation` | `VALIDATION_ERROR` | 422 |
| `ErrConflict` | `CONFLICT` | 409 |
| lainnya | `INTERNAL_ERROR` | 500 |

Implementasi: `shared/errors.AppError` dengan `Code`, `HTTPStatus`, `Message`, `Details`,
`Unwrap`.

## 8. Validasi Request

### 8.1 Lapisan

1. **Binding**: JSON malformed → 400 `MALFORMED_JSON`.
2. **Validator** (`go-playground/validator`): field rules → 422 `VALIDATION_ERROR`.
3. **Service**: aturan bisnis (referensi, state) → code spesifik (422/409).
4. **Database**: constraint (unique, FK) → dipetakan ke code yang sama (bukan 500).

### 8.2 Contoh Aturan

| Field | Rule | Pesan |
|---|---|---|
| `email` | `required,email,max=254` | `must be a valid email address` |
| `password` | `required,min=8,max=72` | `must be between 8 and 72 characters` |
| `name` | `required,min=1,max=100` | `must be between 1 and 100 characters` |
| `title` | `required,min=1,max=200` | `must be between 1 and 200 characters` |
| `priority` | `omitempty,oneof=LOW MEDIUM HIGH URGENT` | `must be one of ...` |
| `status` | `omitempty,oneof=TODO IN_PROGRESS DONE` | `must be one of ...` |
| `role` | `required,oneof=ADMIN MEMBER` | `must be one of ADMIN, MEMBER` |
| `due_at` | `omitempty,datetime=2006-01-02T15:04:05Z07:00` | `must be a valid RFC3339 timestamp with timezone` |
| `color` | `required,hexcolor` | `must be a hex color (#RRGGBB)` |
| `limit` | `omitempty,min=1,max=100` | `must be between 1 and 100` |
| `cursor` | `omitempty,max=2048` | `is invalid` |

### 8.3 Pesan Validasi

- Bahasa Inggris, tanpa menyebut tipe Go.
- Tidak meng-echo nilai password/token.
- Untuk enum, sebutkan nilai yang diizinkan.

## 9. Error 404 vs 403 vs 409

| Situasi | Status | Alasan |
|---|---|---|
| Workspace tidak ada | 404 | Tidak membocorkan |
| User bukan member | 404 | Tidak membocorkan |
| Member role kurang | 403 | Keberadaan diketahui |
| Task tidak ada di workspace | 404 | Mencegah IDOR |
| Task ada di workspace lain | 404 | Mencegah IDOR |
| Menghapus owner | 409 | Konflik aturan, bukan izin |
| Undangan sudah ACCEPTED | 409 | State konflik |
| Invitation expired | 410 | Resource tidak lagi berlaku |
| Email undangan beda | 403 | Authenticated tapi bukan penerima |

## 10. Perilaku Framework

- **Route tidak ditemukan**: Gin default 404 dengan body kosong. Kita memasang `NoRoute`
  handler yang mengembalikan envelope `ROUTE_NOT_FOUND`.
- **Method tidak didukung**: Gin mengembalikan 404, bukan 405, secara default. Kita
  mendeteksi path yang ada dan mengembalikan `METHOD_NOT_ALLOWED` 405.
- **Panic**: recovery middleware menangkap, mencatat stack di log, mengembalikan
  `INTERNAL_ERROR` 500 tanpa detail.
- **Body terlalu besar**: middleware `MaxBytesReader` mengembalikan 413
  `PAYLOAD_TOO_LARGE`.
- **Timeout**: context deadline → 503/504? **Keputusan:** 503 `SERVICE_UNAVAILABLE` untuk
  timeout internal; tidak memakai 504 karena tidak ada upstream proxy di dalam aplikasi.

## 11. Logging Error

| Level | Kondisi | Field |
|---|---|---|
| WARN | 4xx yang mencurigakan (401/403/429) | request_id, user_id, code, path |
| ERROR | 5xx | request_id, user_id, code, error, stack (500) |
| INFO | 4xx validasi normal | request_id, code |

Aturan redaksi:

- Jangan log `Authorization`, `password`, `refresh_token`, `token`.
- Jangan log body penuh untuk endpoint auth.
- Log query string setelah menghapus `token`/`cursor`? Cursor aman (opaque), tetapi tetap
  dipotong.

## 12. Retryability

| Code | Client boleh retry? |
|---|---|
| `INTERNAL_ERROR` | Ya, dengan backoff |
| `NOT_READY` | Ya, setelah delay |
| `TOO_MANY_REQUESTS` | Ya, setelah `Retry-After` |
| `INVALID_CURSOR` | Tidak (mulai dari awal) |
| `VALIDATION_ERROR` | Tidak sebelum diperbaiki |
| `FORBIDDEN` | Tidak |
| `WORKSPACE_NOT_FOUND` | Tidak |
| `CONFLICT` | Tidak (kecuali state berubah) |

## 13. Keputusan dan Trade-off

| Keputusan | Alasan | Alternatif |
|---|---|---|
| `code` + `message` | Client dapat menangani tanpa parsing teks | Hanya message (rapuh) |
| 404 untuk non-member | Anti-enumerasi | 403 (bocor existence) |
| 422 untuk validasi | Membedakan sintaks vs semantik | 400 untuk semua (kurang presisi) |
| `details.fields` map | Ringkas, mudah diparse | Array (lebih verbose) |
| Tanpa stack trace | Keamanan | Debug di client (tidak aman) |
| `request_id` di error | Korelasi log | Tanpa ID (sulit debug) |
| 405 eksplisit | Kontrak HTTP benar | 404 (membingungkan) |
| Satu pesan per field | Response kecil | Semua pesan (besar) |
