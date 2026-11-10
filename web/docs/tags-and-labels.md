# Tag dan label

Tag dan label adalah dua resource berbeda pada backend. Keduanya workspace-scoped dan dapat dilampirkan ke todo, tetapi memiliki bentuk data, batas, dan aturan assignment yang berbeda.

## Perbedaan berdasarkan backend

| Aspek                 | Tag                                                                            | Label                                                                         |
| --------------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------- |
| Endpoint              | `/tags`                                                                        | `/labels`                                                                     |
| Field                 | `id`, `workspaceId`, `name`, `createdAt`, `updatedAt`                          | `id`, `workspaceId`, `name`, `color`, `description`, `createdAt`, `updatedAt` |
| Warna                 | Tidak ada                                                                      | `#RRGGBB` wajib                                                               |
| Deskripsi             | Tidak ada                                                                      | Opsional, maksimal 300 karakter                                               |
| Relasi ke todo        | Banyak-ke-banyak, maksimal 20 tag                                              | Satu label utama per todo                                                     |
| Assignment            | `PUT /todos/:todoId/tags` mengganti seluruh tag; `POST/DELETE .../tags/:tagId` | `PUT /todos/:todoId/label` dengan `labelId`; `DELETE .../label`               |
| Filter todo           | `?tagIds=a&tagIds=b` dengan semantics **ANY**                                  | `?labelId=...`                                                                |
| CRUD permission       | `owner` dan `admin`                                                            | `owner` dan `admin`                                                           |
| Assignment permission | Semua member workspace                                                         | Semua member workspace                                                        |

Tidak ada endpoint tag/label global. Semua operasi wajib membawa `workspaceId`.

## Model domain

### Tag

```ts
interface Tag {
  id: string;
  workspaceId: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Label

```ts
interface Label {
  id: string;
  workspaceId: string;
  name: string;
  color: string; // #RRGGBB uppercase
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

DTO memakai string ISO untuk tanggal; mapper mengubahnya menjadi `Date`. Guard menolak respons yang tidak lengkap atau warna yang tidak valid.

## CRUD

### Tag

- `GET /api/v1/workspaces/:workspaceId/tags?limit&cursor&q`
- `GET /api/v1/workspaces/:workspaceId/tags/:tagId`
- `POST /api/v1/workspaces/:workspaceId/tags` body `{ name }`
- `PATCH /api/v1/workspaces/:workspaceId/tags/:tagId` body `{ name }`
- `DELETE /api/v1/workspaces/:workspaceId/tags/:tagId` → `204`

Nama 1–50 karakter setelah trim dan unik case-insensitive per workspace. Duplikat ditolak backend; frontend menampilkan pesan dari `ApiError`.

### Label

- `GET /api/v1/workspaces/:workspaceId/labels?limit&cursor&q`
- `GET /api/v1/workspaces/:workspaceId/labels/:labelId`
- `POST /api/v1/workspaces/:workspaceId/labels` body `{ name, color, description? }`
- `PATCH /api/v1/workspaces/:workspaceId/labels/:labelId` body parsial
- `DELETE /api/v1/workspaces/:workspaceId/labels/:labelId` → `204`

Nama 1–50 karakter, unik case-insensitive per workspace. `color` wajib `#RRGGBB`. `description` maksimal 300 karakter dan dapat `null`.

## Assignment

- Mengganti tag todo: `PUT /todos/:todoId/tags` body `{ tagIds: string[] }`. Array kosong melepas semua tag.
- Menambah satu tag: `POST /todos/:todoId/tags/:tagId`.
- Melepas satu tag: `DELETE /todos/:todoId/tags/:tagId`.
- Memasang label: `PUT /todos/:todoId/label` body `{ labelId }`. Label sebelumnya diganti.
- Melepas label: `DELETE /todos/:todoId/label`.

Frontend memakai operasi replace untuk tag karena form menyimpan satu set pilihan. Label memakai operasi assign/clear. Create todo tidak menerima `tagIds` atau `labelId`; metadata disimpan setelah todo berhasil dibuat.

## Query hook dan cache

- `useTags(workspaceId)` dan `useLabels(workspaceId)` memakai key yang membawa `workspaceId`.
- `useCreateTag`, `useUpdateTag`, `useDeleteTag` menginvalidasi daftar tag workspace.
- `useReplaceTodoTags`, `useAssignTodoLabel`, `useClearTodoLabel` menginvalidasi daftar todo serta detail todo terkait.
- Perubahan nama/warna tag atau label juga menginvalidasi cache todo workspace agar badge pada todo tidak basi.
- Tidak ada invalidasi lintas workspace.

## Komponen UI

- `TagBadge` / `LabelBadge`: badge read-only dengan teks; warna label bukan satu-satunya pembeda karena nama selalu ditampilkan.
- `TagSelector`: checkbox multi-pilih, state loading/error/empty, mempertahankan pilihan saat form dibuka ulang.
- `LabelSelector`: select satu label dengan opsi "Tanpa label", state loading/error/empty.
- `TagDialog` / `LabelDialog`: create dan edit memakai React Hook Form + Zod.
- `DeleteTagDialog` / `DeleteLabelDialog`: konfirmasi penghapusan.
- `TagsPage` / `LabelsPage`: daftar, create, edit, delete, empty state, error, dan loading.

## Halaman dan permission

Route:

- `/workspace/:workspaceId/tags`
- `/workspace/:workspaceId/labels`

Kedua halaman terhubung ke menu secondary sidebar. Tombol create/edit/delete hanya ditampilkan untuk `owner` dan `admin`. Member tetap dapat melihat daftar dan memilih tag/label pada todo. Backend tetap menjadi otoritas akhir; respons `403` ditampilkan sebagai error yang dapat dibaca.

## Batasan

- Label tidak memiliki halaman detail terpisah.
- Jumlah tag per todo dibatasi backend (20). Frontend tidak menampilkan counter khusus; backend mengembalikan `422` bila terlampaui.
- Pencarian tag/label memakai `q` backend, tetapi UI Phase 5 belum menambahkan kolom pencarian khusus.
- Pagination halaman tag/label hanya memuat halaman pertama dengan `limit=100`.
