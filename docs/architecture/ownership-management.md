# Kepemilikan Workspace

Setiap workspace memiliki tepat satu owner. Itu dijaga oleh indeks unik parsial:

```sql
UNIQUE (workspace_id) WHERE role = 'owner'
```

Aplikasi tidak mengizinkan workspace tanpa owner setelah operasi yang berhasil.

## Transfer

`POST /api/v1/workspaces/:workspaceId/transfer-ownership` hanya boleh dipanggil owner. Target harus anggota aktif dan bukan owner saat ini.

Dalam satu transaksi:

1. Kunci baris workspace.
2. Pastikan pemanggil masih owner.
3. Turunkan owner lama menjadi `admin`.
4. Naikkan target menjadi `owner`.
5. Commit.

Penurunan dilakukan lebih dulu supaya indeks satu-owner tidak menolak kenaikan. Jika langkah mana pun gagal, kedua perubahan ikut rollback.

Endpoint ubah role tidak menerima nilai `owner`.

## Keluar

Member dan admin boleh `POST /leave`. Owner menerima `409 OWNER_TRANSFER_REQUIRED`. Workspace dan Todo tidak dihapus. Pengguna yang sudah keluar tidak lagi lolos pemeriksaan membership; permintaan berikutnya mendapat 404.
