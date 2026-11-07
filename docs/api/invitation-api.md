# API Undangan

Semua endpoint memakai prefix `/api/v1` dan Bearer access token. Token undangan tidak pernah ada di response.

## Buat

`POST /workspaces/:workspaceId/invitations`

```json
{ "email": "friend@example.com", "role": "member" }
```

HTTP 201. Body berisi `invitation` dengan `id`, `workspaceId`, `email`, `role`, `status`, `deliveryStatus`, `expiresAt`, `createdAt`. Jika SMTP gagal, status tetap `pending` dan `deliveryStatus` menjadi `failed`.

Role `owner` ditolak. Admin tidak boleh mengirim role `admin`.

## Daftar workspace

`GET /workspaces/:workspaceId/invitations?limit&cursor&status&role`

Owner melihat semua. Admin hanya melihat role `member`. Cursor opaque, default limit 20, maksimum 100, urutan `createdAt DESC, id DESC`.

## Kirim ulang dan cabut

`POST /workspaces/:workspaceId/invitations/:invitationId/resend` mengembalikan 200 dan undangan dengan masa berlaku baru.

`DELETE /workspaces/:workspaceId/invitations/:invitationId` mengembalikan 204.

## Undangan saya

`GET /invitations?limit&cursor&status`

Filter email diambil dari akun yang login. Item memuat `workspace { id, name }`, `inviter { id, displayName }`, `role`, `status`, `expiresAt`.

## Terima dan tolak

```http
POST /invitations/:invitationId/accept
POST /invitations/:invitationId/decline
```

Body: `{ "token": "raw-token" }`. Jangan kirim token di query string.

Accept 200:

```json
{ "membership": { "workspaceId": "...", "userId": "...", "role": "member", "joinedAt": "..." } }
```

Decline 200 mengembalikan undangan berstatus `declined` tanpa token.

Kode yang sering muncul: `INVITATION_NOT_FOUND`, `INVITATION_TOKEN_INVALID`, `INVITATION_EMAIL_MISMATCH`, `INVITATION_EXPIRED`, `INVITATION_ALREADY_PENDING`, `INVITATION_ALREADY_ACCEPTED`, `INVITATION_ALREADY_DECLINED`, `INVITATION_ALREADY_REVOKED`, `INVITATION_RESEND_NOT_ALLOWED`.
