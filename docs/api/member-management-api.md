# API Anggota

Semua endpoint membutuhkan Bearer token dan membership terkini.

## Daftar dan detail

`GET /api/v1/workspaces/:workspaceId/members?limit&cursor&role`

`GET /api/v1/workspaces/:workspaceId/members/:userId`

Item:

```json
{
  "user": { "id": "uuid", "email": "developer@example.com", "displayName": "Developer" },
  "membership": { "role": "member", "joinedAt": "2026-11-07T05:00:00.000Z" }
}
```

Tidak ada `passwordHash` atau session. Urutan `joinedAt DESC, userId DESC`.

## Ubah role

`PATCH /workspaces/:workspaceId/members/:userId`

```json
{ "role": "admin" }
```

Hanya owner. Nilai yang sah `admin` atau `member`. Owner tidak mengubah role dirinya di endpoint ini.

## Hapus

`DELETE /workspaces/:workspaceId/members/:userId` → 204.

Owner menghapus admin dan member, bukan dirinya. Admin hanya menghapus member.

## Keluar

`POST /workspaces/:workspaceId/leave` → 204.

Owner mendapat `409 OWNER_TRANSFER_REQUIRED`.

## Transfer

`POST /workspaces/:workspaceId/transfer-ownership`

```json
{ "newOwnerUserId": "uuid" }
```

Response 200:

```json
{
  "workspace": { "id": "workspace-uuid" },
  "ownership": {
    "previousOwner": { "userId": "old-owner-uuid", "role": "admin" },
    "newOwner": { "userId": "new-owner-uuid", "role": "owner" }
  }
}
```

Target yang bukan anggota mengembalikan `WORKSPACE_MEMBER_NOT_FOUND`. Transfer ke diri sendiri mengembalikan `OWNERSHIP_TRANSFER_INVALID`.
