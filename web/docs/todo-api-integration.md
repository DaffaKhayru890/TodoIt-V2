# Integrasi API Todo (Phase 4)

Dokumen ini mencatat kontrak backend yang dipakai, service frontend, query key, strategi cache, dan penanganan error pada fitur todo.

Sumber kebenaran adalah source code backend (`src/modules/todo/presentation/http/todo.routes.ts`, `todo.schemas.ts`, dan use case terkait), bukan asumsi frontend.

---

## A. Endpoint yang Dipakai

| Method   | Endpoint                                                 | Fungsi                  | Sukses |
| -------- | -------------------------------------------------------- | ----------------------- | ------ |
| `GET`    | `/api/v1/workspaces/:workspaceId/todos`                  | Daftar todo (cursor)    | 200    |
| `GET`    | `/api/v1/workspaces/:workspaceId/todos/:todoId`          | Detail todo             | 200    |
| `POST`   | `/api/v1/workspaces/:workspaceId/todos`                  | Membuat todo            | 201    |
| `PATCH`  | `/api/v1/workspaces/:workspaceId/todos/:todoId`          | Mengubah field tertentu | 200    |
| `PATCH`  | `/api/v1/workspaces/:workspaceId/todos/:todoId/complete` | Menandai selesai        | 200    |
| `DELETE` | `/api/v1/workspaces/:workspaceId/todos/:todoId`          | Soft delete             | 204    |

Seluruh endpoint memerlukan `Authorization: Bearer <accessToken>`.

Endpoint backend lain (`today`, `upcoming`, `overdue`, tag, label, reminder) tidak dipakai pada Phase 4.

---

## B. Request dan Response

### 1. Daftar todo

**Request**

```http
GET /api/v1/workspaces/:workspaceId/todos?limit=100
```

Query yang didukung backend: `limit` (1–100, default 20), `cursor`, serta filter status/priority/label dan rentang tanggal. Phase 4 hanya mengirim `limit` dan, bila ada, `cursor`.

**Response 200**

```json
{
  "items": [
    {
      "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      "workspaceId": "11111111-1111-4111-8111-111111111111",
      "title": "Menyusun rencana sprint",
      "description": "Tentukan prioritas minggu ini.",
      "status": "todo",
      "priority": "low",
      "dueAt": null,
      "completedAt": null,
      "label": null,
      "tags": [],
      "createdBy": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
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

Tidak ada `total` pada pagination todo. Urutan backend adalah `createdAt DESC, id DESC`.

### 2. Detail todo

```json
{
  "todo": {
    "id": "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    "workspaceId": "11111111-1111-4111-8111-111111111111",
    "title": "Menyusun rencana sprint",
    "description": null,
    "status": "todo",
    "priority": "low",
    "dueAt": null,
    "completedAt": null,
    "label": null,
    "tags": [],
    "createdBy": "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
    "createdAt": "2026-11-07T09:00:00.000Z",
    "updatedAt": "2026-11-07T09:00:00.000Z"
  }
}
```

Todo yang tidak ada, sudah dihapus, atau berada di workspace lain menghasilkan `404 TODO_NOT_FOUND` (atau `WORKSPACE_ACCESS_DENIED` bila akses workspace ditolak).

### 3. Membuat todo

```json
{
  "title": "Menyusun rencana sprint",
  "description": "Tentukan prioritas minggu ini."
}
```

Backend juga menerima `priority` dan `dueAt`, tetapi Phase 4 tidak mengirimkannya. `description` kosong dikirim sebagai `null`. `status` tidak boleh dikirim saat create.

### 4. Mengubah todo

`PATCH` menerima body parsial: `title`, `description`, `status`, `priority`, `dueAt`, `labelId`, `tagIds`. Phase 4 hanya mengirim `title`, `description`, dan `status`.

```json
{ "title": "Judul baru" }
```

Frontend tidak mengirim field `undefined`. Ini penting karena schema backend memakai `additionalProperties: false`.

Reopen memakai:

```json
{ "status": "todo" }
```

### 5. Menandai selesai

```http
PATCH /api/v1/workspaces/:workspaceId/todos/:todoId/complete
```

Tanpa body. Respons berisi objek `todo` terbaru dengan `status: "completed"` dan `completedAt` terisi.

### 6. Menghapus todo

```http
DELETE /api/v1/workspaces/:workspaceId/todos/:todoId
```

Respons `204 No Content`. Operasi bersifat soft delete dan idempoten.

---

## C. Otorisasi

Hasil audit backend:

- Seluruh anggota workspace (`owner`, `admin`, `member`) boleh melihat, membuat, mengubah, menyelesaikan, dan menghapus todo.
- Non-member dan workspace yang sudah diarsipkan menghasilkan `404` dengan kode `WORKSPACE_ACCESS_DENIED` untuk mencegah enumerasi.
- Role tanpa izin menghasilkan `403 WORKSPACE_PERMISSION_DENIED`.
- Todo milik workspace lain tidak dapat diakses melalui kombinasi `workspaceId`/`todoId` yang salah.

Frontend tidak menyembunyikan aksi berdasarkan role karena seluruh anggota memang berhak. Penolakan tetap ditangani dari respons backend.

---

## D. Service dan DTO

### File

```text
src/features/todos/models/
├── todo.dto.ts        # Bentuk response backend (string ISO)
├── todo.model.ts      # Domain model + helper status
├── todo.guard.ts      # Validasi runtime respons
└── todo.mapper.ts     # DTO ↔ domain ↔ request DTO
src/features/todos/api/
├── todo.api.ts        # Service HTTP
└── todo.query-keys.ts # Query key factory
```

### Alur data

```text
Komponen
  → hook TanStack Query
    → todoApi
      → httpClient (core)
        → backend
```

### Validasi respons

Sebelum dipetakan, respons diperiksa oleh guard:

- `assertTodoResponseDto` untuk `{ todo }`.
- `assertTodoListResponseDto` untuk `{ items, pagination }`.

Jika bentuk respons tidak sesuai, frontend melempar `ApiError` dengan kode `INVALID_TODO_RESPONSE` dan status `0`. UI menampilkan state error, bukan crash.

### Normalisasi request

- `title` dan `description` di-trim sebelum dikirim.
- Deskripsi kosong menjadi `null`.
- `PATCH` hanya memuat field yang berubah.

---

## E. Query Key dan Cache

```ts
todoKeys = {
  all: ['todos'],
  lists: () => [...all, 'list'],
  workspaceLists: (workspaceId) => [...lists(), 'workspace', workspaceId],
  workspace: (workspaceId, params) => [...workspaceLists(workspaceId), params],
  details: () => [...all, 'detail'],
  detail: (workspaceId, todoId) => [...details(), workspaceId, todoId]
};
```

### Invalidasi

| Mutation | Cache detail                            | Cache list                               |
| -------- | --------------------------------------- | ---------------------------------------- |
| Create   | `setQueryData(detail(workspaceId, id))` | invalidate `workspaceLists(workspaceId)` |
| Update   | `setQueryData(detail(...))`             | invalidate `workspaceLists(workspaceId)` |
| Complete | `setQueryData(detail(...))`             | invalidate `workspaceLists(workspaceId)` |
| Reopen   | `setQueryData(detail(...))`             | invalidate `workspaceLists(workspaceId)` |
| Delete   | `removeQueries(detail(...))`            | invalidate `workspaceLists(workspaceId)` |

Semua key membawa `workspaceId`, sehingga mutation di Workspace B tidak menyentuh cache Workspace A. Ini diuji secara eksplisit.

### Retry

- `401`, `403`, `404`: tidak di-retry.
- Error lain: satu kali retry.

---

## F. Penanganan Error

Envelope backend:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Permintaan tidak lolos validasi skema.",
    "requestId": "req-xyz",
    "details": [{ "path": "body.title", "message": "Judul wajib diisi." }]
  }
}
```

`httpClient` menormalkannya menjadi `ApiError` dengan `status`, `code`, `message`, dan `details`.

Pemetaan di UI:

| Kondisi                               | Tampilan                             |
| ------------------------------------- | ------------------------------------ |
| `VALIDATION_ERROR` dengan detail      | Pesan di field form terkait          |
| `VALIDATION_ERROR` tanpa detail cocok | Pesan umum di atas form              |
| `TODO_NOT_FOUND` / 404                | State “Tugas tidak ditemukan”        |
| `WORKSPACE_PERMISSION_DENIED` / 403   | State “Akses ditolak”                |
| `NETWORK_ERROR` / 5xx                 | Pesan error + tombol coba lagi       |
| Respons rusak                         | `INVALID_TODO_RESPONSE`, state error |

UI tidak pernah menampilkan stack trace atau objek error mentah.

---

## G. Catatan Integrasi End-to-End

Login, penyimpanan access token, dan refresh belum diimplementasikan. `httpClient` sudah menyediakan `getAccessToken`, tetapi aplikasi belum memiliki alur autentikasi. Pengujian integrasi karena itu memakai MSW dengan kontrak yang sama seperti backend.
