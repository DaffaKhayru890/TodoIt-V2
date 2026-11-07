# Dokumentasi API Workspace

Base URL: `/api/v1/workspaces`

Seluruh endpoint pada Workspace Module mewajibkan autentikasi via header `Authorization: Bearer <accessToken>`.

---

## 1. Create Workspace

Membuat workspace baru. Pembuat akun otomatis mendapatkan keanggotaan dengan peran `OWNER`.

- **Method**: `POST`
- **Path**: `/api/v1/workspaces`
- **Auth**: Bearer Access Token

### Request Body
```json
{
  "name": "Personal Workspace",
  "description": "My personal tasks"
}
```

### Response
**Status 201 Created**:
```json
{
  "workspace": {
    "id": "e4b6c321-1234-5678-abcd-0987654321fe",
    "name": "Personal Workspace",
    "description": "My personal tasks",
    "role": "owner",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "archivedAt": null
  }
}
```

### Error Responses
- **401 Unauthorized**: Token tidak valid atau session dicabut.
- **422 Unprocessable Content**: `WORKSPACE_NAME_INVALID` (nama kosong atau > 100 karakter), atau deskripsi > 500 karakter.

---

## 2. List Workspaces

Mengambil seluruh workspace aktif milik pengguna dengan dukungan paginasi.

- **Method**: `GET`
- **Path**: `/api/v1/workspaces`
- **Auth**: Bearer Access Token
- **Query Parameters**:
  - `limit` (opsional, default 20, max 50): Jumlah data per halaman.
  - `offset` (opsional, default 0): Posisi awal data.

### Response
**Status 200 OK**:
```json
{
  "items": [
    {
      "id": "e4b6c321-1234-5678-abcd-0987654321fe",
      "name": "Personal Workspace",
      "description": "My personal tasks",
      "role": "owner",
      "createdAt": "2026-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 1
  }
}
```

*Catatan: Workspace yang telah diarsipkan tidak akan ditampilkan pada daftar ini.*

---

## 3. Get Workspace Detail

Mengambil detail lengkap workspace berdasarkan ID. Hanya anggota/owner yang dapat mengakses.

- **Method**: `GET`
- **Path**: `/api/v1/workspaces/:workspaceId`
- **Auth**: Bearer Access Token

### Response
**Status 200 OK**:
```json
{
  "workspace": {
    "id": "e4b6c321-1234-5678-abcd-0987654321fe",
    "name": "Personal Workspace",
    "description": "My personal tasks",
    "role": "owner",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T00:00:00.000Z",
    "archivedAt": null
  }
}
```

### Error Responses
- **404 Not Found**: `WORKSPACE_ACCESS_DENIED` ("Workspace tidak ditemukan.") — jika workspace tidak ada, sudah diarsipkan, atau pengguna bukan anggota.

---

## 4. Update Workspace

Memperbarui nama atau deskripsi workspace. Hanya dapat dilakukan oleh `OWNER`.

- **Method**: `PATCH`
- **Path**: `/api/v1/workspaces/:workspaceId`
- **Auth**: Bearer Access Token

### Request Body
Minimal satu field harus diberikan.
```json
{
  "name": "Updated Workspace",
  "description": "Updated description"
}
```

### Response
**Status 200 OK**:
```json
{
  "workspace": {
    "id": "e4b6c321-1234-5678-abcd-0987654321fe",
    "name": "Updated Workspace",
    "description": "Updated description",
    "role": "owner",
    "createdAt": "2026-01-01T00:00:00.000Z",
    "updatedAt": "2026-01-01T01:00:00.000Z",
    "archivedAt": null
  }
}
```

### Error Responses
- **403 Forbidden**: `WORKSPACE_PERMISSION_DENIED` (bukan owner).
- **404 Not Found**: `WORKSPACE_ACCESS_DENIED` (bukan anggota atau workspace tidak ada).
- **422 Unprocessable Content**: Nama tidak valid atau request body kosong.

---

## 5. Archive Workspace

Mengarsipkan workspace secara lunak (soft archive). Hanya dapat dilakukan oleh `OWNER`.

- **Method**: `POST`
- **Path**: `/api/v1/workspaces/:workspaceId/archive`
- **Auth**: Bearer Access Token

### Response
**Status 200 OK**:
```json
{
  "workspace": {
    "id": "e4b6c321-1234-5678-abcd-0987654321fe",
    "archivedAt": "2026-01-01T02:00:00.000Z"
  }
}
```

*Catatan: Operasi ini bersifat idempoten. Memanggil endpoint ini berulang kali akan mengembalikan nilai sukses.*
