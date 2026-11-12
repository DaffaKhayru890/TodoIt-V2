# API — Response Convention

## 1. Prinsip

1. **Satu bentuk envelope** untuk semua response agar client memiliki satu parser.
2. **Sukses dan error dibedakan oleh field `success`**, bukan hanya HTTP status.
3. **Field `data` konsisten tipe** untuk endpoint yang sama.
4. **Tidak ada data internal** (`password_hash`, `token_hash`, `deleted_at`) di response.
5. **Waktu selalu UTC** dengan suffix `Z`.
6. **Null eksplisit** untuk field nullable yang relevan; field yang tidak relevan dihilangkan
   dengan `omitempty` (dokumentasikan di OpenAPI).

## 2. Envelope Sukses

```json
{
  "success": true,
  "message": "Task created successfully",
  "data": { }
}
```

| Field | Tipe | Wajib | Keterangan |
|---|---|---|---|
| `success` | boolean | Ya | Selalu `true` untuk 2xx |
| `message` | string | Ya | Pesan manusiawi, stabil per endpoint |
| `data` | object/array/null | Ya (kecuali 204) | Payload |
| `pagination` | object | Hanya list | Lihat §4 |
| `meta` | object | Hanya endpoint tertentu | Lihat §5 |

Aturan `message`:

- Bahasa Inggris, sentence case, diakhiri titik? **Tidak** diakhiri titik (konsisten).
- Tidak mengandung data sensitif.
- Tidak dimaksudkan untuk parsing; client memakai `error.code` untuk error.

## 3. Status dan Body

| Status | Body | Contoh |
|---|---|---|
| 200 | envelope + `data` | GET, PATCH, complete |
| 201 | envelope + `data` | POST create |
| 204 | **tanpa body** | DELETE, logout |
| 4xx/5xx | envelope error | Lihat `error-convention.md` |

Tidak mengembalikan `data: null` untuk 204. Client tidak boleh mengharapkan body.

## 4. Pagination Envelope

```json
{
  "success": true,
  "message": "Tasks retrieved successfully",
  "data": [],
  "pagination": {
    "limit": 20,
    "next_cursor": "eyJ2Ijox...",
    "has_more": true
  }
}
```

| Field | Tipe | Keterangan |
|---|---|---|
| `limit` | integer | Limit yang benar-benar dipakai (setelah clamp) |
| `next_cursor` | string/null | `null` jika tidak ada halaman berikutnya |
| `has_more` | boolean | `true` jika `next_cursor != null` |

Tidak ada `total`, `page`, `total_pages`. Alasan: menghitung total mahal dan tidak diperlukan
untuk infinite scroll. Jika client butuh jumlah, sediakan endpoint statistik terpisah di
masa depan.

Aturan:

- `next_cursor` hanya dikirim jika `has_more=true`.
- `limit` di-clamp ke 1–100; jika client mengirim 500, response `limit: 100`.
- Cursor kosong (`""`) dianggap tidak ada.
- Cursor tidak pernah dikembalikan di header.

## 5. Meta

`meta` dipakai untuk konteks yang tidak termasuk data:

### Today/Upcoming/Overdue

```json
"meta": {
  "timezone": "Asia/Jakarta",
  "date": "2026-11-12",
  "range_start": "2026-11-11T17:00:00Z",
  "range_end": "2026-11-12T17:00:00Z"
}
```

### Upcoming

```json
"meta": {
  "timezone": "Asia/Jakarta",
  "date": "2026-11-12",
  "range_start": "2026-11-12T17:00:00Z",
  "range_end": "2026-11-18T17:00:00Z",
  "days": 7
}
```

### Read-all

`data` berisi counter; tidak perlu meta.

## 6. Bentuk DTO

### 6.1 Penamaan

| Tipe | Contoh | Catatan |
|---|---|---|
| Request | `CreateTaskRequest` | Hanya field yang boleh dikirim |
| Response | `TaskResponse` | Hanya field yang boleh dibaca |
| List item | `TaskSummary` | Field lebih sedikit dari detail |
| Internal | `TaskFilter` | Tidak diekspos ke JSON |

Aturan:

- DTO request dan response **terpisah**. Tidak memakai model GORM langsung.
- DTO response tidak memiliki field `password_hash`, `token_hash`, `deleted_at`.
- DTO request tidak memiliki `id`, `workspace_id` (dari path), `created_at`, `updated_at`,
  `owner_id` (kecuali create workspace yang memakai user dari token).

### 6.2 Contoh DTO Task

```json
{
  "id": "01a1...",
  "workspace_id": "019c...",
  "title": "Tulis dokumentasi API",
  "description": "Lengkapi OpenAPI",
  "status": "TODO",
  "priority": "HIGH",
  "due_at": "2026-11-15T10:00:00Z",
  "completed_at": null,
  "created_by": "019a...",
  "assignee": {
    "id": "019d...",
    "name": "Rina",
    "email": "rina@example.com"
  },
  "tags": [{"id": "019f...", "name": "docs"}],
  "labels": [{"id": "01a0...", "name": "Feature", "color": "#3B82F6"}],
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
}
```

Keputusan:

- `assignee` berupa objek ringkas, bukan hanya ID, agar UI tidak perlu join.
- `tags`/`labels` selalu array (bukan null); kosong = `[]`.
- `description` null jika tidak ada.
- `due_at`/`completed_at` null jika tidak ada.

### 6.3 Contoh DTO Workspace

```json
{
  "id": "019c...",
  "name": "Product Team",
  "description": null,
  "owner_id": "019a...",
  "role": "OWNER",
  "member_count": 3,
  "created_at": "2026-11-12T10:00:00Z",
  "updated_at": "2026-11-12T10:00:00Z"
}
```

`role` adalah role user yang sedang login, bukan role orang lain.

## 7. Null dan Array

| Kasus | Aturan |
|---|---|
| Field opsional tidak ada | `null` (bukan dihilangkan) untuk field yang dideklarasikan nullable |
| Array kosong | `[]`, bukan `null` |
| Objek relasi tidak ada | `null` |
| `omitempty` | Hanya untuk field yang tidak relevan secara semantik; didokumentasikan di OpenAPI |

Alasan: client JavaScript dapat membedakan "tidak ada" vs "kosong" dengan konsisten.

## 8. Tanggal dan Waktu

- Format: RFC3339 dengan `Z`.
- Tidak ada milidetik pada response (disimpan presisi database, tetapi diformat detik).
  **Keputusan:** gunakan `time.RFC3339` (detik). Jika presisi milidetik dibutuhkan untuk
  cursor, cursor memakai Unix nano secara internal, bukan string waktu.
- `date` pada meta: `YYYY-MM-DD` (tanggal lokal user).
- Konversi timezone dilakukan client.

## 9. Header Response

| Header | Kapan |
|---|---|
| `Content-Type: application/json; charset=utf-8` | Response berbody |
| `X-Request-ID` | Semua response |
| `Retry-After` | 429 |
| `Location` | Tidak dipakai (201 tanpa Location) |
| `X-Total-Count` | Tidak dipakai |

Tidak memakai `Location` karena client sudah menerima `id` di body. Ini keputusan sederhana;
jika REST strict diinginkan, tambahkan `Location` di Phase 7.

## 10. Response List vs Detail

| Endpoint | Bentuk item |
|---|---|
| `GET /tasks` | `TaskSummary` (tanpa `description`? — **dengan** description agar konsisten) |
| `GET /tasks/{id}` | `TaskResponse` lengkap |
| `GET /workspaces` | `WorkspaceSummary` + role + member_count |
| `GET /workspaces/{id}` | `WorkspaceResponse` |
| `GET /notifications` | `NotificationResponse` |
| `GET /members` | `MemberResponse` |

Keputusan: list task menyertakan `description` (dipotong 500 char) agar UI dapat menampilkan
preview tanpa request tambahan. Detail mengembalikan penuh (≤ 10.000).

## 11. Contoh Lengkap per Operasi

### Create

```http
POST /api/v1/workspaces/019c.../tasks
```

```json
{
  "success": true,
  "message": "Task created successfully",
  "data": {"id": "01a1...", "title": "Tulis dokumentasi API", "status": "TODO"}
}
```

Status: `201`.

### Update

```http
PATCH /api/v1/workspaces/019c.../tasks/01a1...
```

```json
{
  "success": true,
  "message": "Task updated successfully",
  "data": {"id": "01a1...", "title": "Tulis dokumentasi API v2", "status": "IN_PROGRESS"}
}
```

Status: `200`.

### Delete

```http
DELETE /api/v1/workspaces/019c.../tasks/01a1...
```

Status: `204`, tanpa body.

### List

```json
{
  "success": true,
  "message": "Tasks retrieved successfully",
  "data": [],
  "pagination": {"limit": 20, "next_cursor": null, "has_more": false}
}
```

### Action

```http
POST /api/v1/workspaces/019c.../tasks/01a1.../complete
```

```json
{
  "success": true,
  "message": "Task completed successfully",
  "data": {"id": "01a1...", "status": "DONE", "completed_at": "2026-11-12T10:00:00Z"}
}
```

## 12. Response Tidak Diizinkan

| Contoh | Alasan |
|---|---|
| `{"data": {...}}` tanpa `success`/`message` | Tidak konsisten |
| `{"error": "not found"}` (string) | Tidak dapat diparse |
| Mengembalikan `password_hash` | Kebocoran |
| Mengembalikan `token_hash` | Kebocoran |
| Mengembalikan `deleted_at` | Internal |
| Mengembalikan stack trace | Kebocoran |
| `data: null` untuk list | Client harus menangani null |
| Pesan error berbahasa Indonesia campur Inggris | Tidak konsisten; gunakan Inggris untuk API, dokumentasi Indonesia |

## 13. Kompatibilitas Perubahan

| Perubahan | Breaking? | Tindakan |
|---|---|---|
| Menambah field response | Tidak | Langsung |
| Menghapus field | Ya | Naikkan versi / deprecation |
| Mengubah tipe field | Ya | Versi baru |
| Mengubah nama field | Ya | Versi baru |
| Menambah nilai enum | Ya (client switch) | Dokumentasikan, pertimbangkan versi |
| Menambah query param opsional | Tidak | Langsung |
| Mengubah default limit | Tidak | Dokumentasikan |

## 14. Validasi Konsistensi

Test kontrak (Phase 7) memeriksa:

- Semua response 2xx memiliki `success: true` dan `message`.
- Semua response 4xx/5xx memiliki `success: false` dan `error.code`.
- List memiliki `pagination`.
- Tidak ada field terlarang di response.
- Tipe field sesuai schema OpenAPI.

## 15. Keputusan dan Trade-off

| Keputusan | Alasan | Alternatif |
|---|---|---|
| Envelope `success/message/data` | Konsisten, mudah di-debug | Raw object (tidak konsisten) |
| Tanpa total count | Infinite scroll tidak butuh; mahal | `total` (query COUNT mahal) |
| `has_more` eksplisit | Client tidak menebak | Hanya `next_cursor` |
| Objek assignee ringkas | Mengurangi request tambahan | Hanya ID (butuh join client) |
| Null eksplisit | Semantik jelas | `omitempty` semua (ambigu) |
| 204 tanpa body | Standar HTTP | 200 dengan `data:null` |
| Waktu detik | Cukup untuk UI | Milidetik (noise) |
