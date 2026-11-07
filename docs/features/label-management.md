# Pengelolaan Label

Label adalah kategori utama. Satu Todo memiliki nol atau satu label. Banyak Todo boleh memakai label yang sama di dalam satu workspace.

## Warna

Format yang diterima: `#RRGGBB`. Contoh valid: `#FF5733`, `#3498DB`, `#2ECC71`, `#9B59B6`. Contoh ditolak: `red`, `#FFF`, `#GGGGGG`, `3498DB`.

Validasi memakai regex. Nilai disimpan uppercase supaya `#3498db` dan `#3498DB` adalah warna yang sama.

Deskripsi opsional, maksimal 300 karakter. String kosong setelah trim disimpan sebagai `null`.

## Contoh

```http
POST /api/v1/workspaces/{workspaceId}/labels
{
  "name": "Personal",
  "color": "#3498DB",
  "description": "Personal tasks"
}
```

Pasang lewat update Todo:

```http
PATCH /api/v1/workspaces/{workspaceId}/todos/{todoId}
{ "labelId": "label-uuid" }
```

Lepas:

```http
PATCH /api/v1/workspaces/{workspaceId}/todos/{todoId}
{ "labelId": null }
```

Atau `DELETE /todos/{todoId}/label`, yang idempoten.

Menghapus label (`DELETE /labels/{labelId}`) membuat `label` pada Todo terkait menjadi `null`. Field Todo lain tidak berubah.

Nama unik per workspace setelah normalisasi yang sama dengan Tag. Owner dan admin mengelola katalog. Semua member boleh memasang label.
