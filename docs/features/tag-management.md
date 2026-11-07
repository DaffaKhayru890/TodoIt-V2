# Pengelolaan Tag

Tag adalah keyword workspace. Satu Todo dapat memiliki hingga 20 tag. Satu tag dapat dipakai banyak Todo di workspace yang sama dan tidak dapat dipakai di workspace lain.

## Normalisasi

`  Backend  `, `backend`, dan `BACKEND` menjadi kunci `backend`. Nama yang disimpan untuk contoh pertama adalah `Backend`. Karakter kontrol ditolak. Panjang dihitung setelah trim, maksimal 50.

## Contoh

Buat:

```http
POST /api/v1/workspaces/{workspaceId}/tags
{ "name": "Backend" }
```

Ganti seluruh tag sebuah Todo:

```http
PUT /api/v1/workspaces/{workspaceId}/todos/{todoId}/tags
{ "tagIds": ["tag-uuid-1", "tag-uuid-2"] }
```

Tambah satu tag (idempoten):

```http
POST /api/v1/workspaces/{workspaceId}/todos/{todoId}/tags/{tagId}
```

Lepas satu tag (idempoten, Todo tanpa tag itu tetap 200):

```http
DELETE /api/v1/workspaces/{workspaceId}/todos/{todoId}/tags/{tagId}
```

Hapus katalog tag:

```http
DELETE /api/v1/workspaces/{workspaceId}/tags/{tagId}
```

Hard delete menghapus association. Todo lain tetap utuh.

Hanya owner dan admin yang membuat, mengubah, atau menghapus katalog. Semua member boleh memasang dan melepas tag pada Todo.
