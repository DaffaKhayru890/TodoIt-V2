# Fitur Todo Management (Phase 4)

Dokumen ini menjelaskan implementasi **Todo Management** pada TodoIt-v2 frontend: ruang lingkup, model domain, perilaku UI, alur pengguna, serta batasan yang disengaja pada Phase 4.

Backend tidak diubah pada phase ini. Seluruh kontrak mengikuti source code backend yang ada.

---

## A. Ruang Lingkup

### Yang diimplementasikan

- Daftar todo per workspace pada halaman `/workspace/:workspaceId`.
- Pemisahan otomatis section **Tugas Aktif** dan **Tugas Selesai**.
- Membuat todo (judul wajib, deskripsi opsional).
- Mengubah judul dan deskripsi todo.
- Menghapus todo dengan dialog konfirmasi.
- Menandai todo selesai lewat checkbox/aksi.
- Membuka kembali todo yang selesai.
- Halaman detail todo pada `/workspace/:workspaceId/todos/:todoId`.
- State loading, empty, error, not found, dan access denied.
- Feedback sukses/gagal untuk setiap mutation.
- Konfirmasi discard ketika form yang sudah diubah ditutup.

### Yang sengaja tidak diimplementasikan

Sesuai batas Phase 4, fitur berikut **tidak** dibuat meskipun backend menyediakannya:

- Tag, label, priority, due date, dan reminder.
- Filter, sorting, pencarian, dan infinite scrolling.
- Notifikasi, sharing, dan invitation.
- Membatalkan todo (`cancelled`) dari UI.
- Restore/hard delete dari UI.

Field `priority`, `dueAt`, `label`, dan `tags` tetap dipetakan dari respons backend agar data tidak hilang atau salah tipe, tetapi tidak ditampilkan sebagai kontrol.

---

## B. Model Domain

### Status

Nilai status mengikuti enum backend:

| Status        | Arti di UI Phase 4             | Section     |
| ------------- | ------------------------------ | ----------- |
| `todo`        | Tugas aktif                    | Aktif       |
| `in_progress` | Tugas aktif yang sedang dipakai | Aktif      |
| `completed`   | Tugas selesai                  | Selesai     |
| `cancelled`   | Dibatalkan                     | Tidak tampil |

`in_progress` diperlakukan sebagai aktif karena Phase 4 tidak menyediakan kontrol untuk mengubah status tersebut. Todo `cancelled` tidak dirender pada kedua section; keputusan ini didokumentasikan agar tidak terlihat seperti bug.

### Priority

`low`, `medium`, `high`, `urgent` dikenali dan divalidasi saat mapping, tetapi belum ditampilkan.

### Bentuk domain

```ts
interface Todo {
  id: string;
  workspaceId: string;
  title: string;
  description: string | null;
  status: TodoStatus;
  priority: TodoPriority;
  dueAt: Date | null;
  completedAt: Date | null;
  label: TodoLabel | null;
  tags: readonly TodoTag[];
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}
```

Tanggal diubah dari string ISO backend menjadi `Date` di mapper. Status dan priority yang tidak dikenal menghasilkan `ApiError` dengan kode `INVALID_TODO_RESPONSE`, bukan dirender sebagai teks bebas.

### Aturan validasi form

| Field       | Aturan                                           |
| ----------- | ------------------------------------------------ |
| `title`     | Wajib, 1–200 karakter setelah trim               |
| `description` | Opsional, maksimal 5000 karakter setelah trim  |

Backend tetap menjadi validator utama. Detail `VALIDATION_ERROR` seperti `body.title` dipetakan kembali ke field form.

---

## C. Alur Pengguna

### 1. Melihat daftar todo

1. Pengguna membuka workspace.
2. `WorkspacePage` merender `WorkspaceTodoSection`.
3. Section mengambil satu halaman todo (maksimum 100 item).
4. Todo dipisahkan menjadi Aktif dan Selesai.
5. Jika belum ada todo, tampil empty state dengan aksi membuat tugas pertama.

### 2. Membuat todo

1. Tombol **Buat Tugas** atau **Buat tugas pertama** membuka dialog.
2. Dialog menampilkan nama workspace sebagai konteks.
3. Setelah submit berhasil, dialog tertutup, daftar di-invalidate, dan feedback sukses muncul.
4. Jika pengguna menutup form yang sudah diisi, `DiscardChanges` muncul lebih dahulu.

### 3. Mengubah todo

- Dari menu aksi item atau tombol **Ubah** di halaman detail.
- Form memuat nilai terkini.
- Hanya field yang benar-benar berubah yang dikirim melalui `PATCH`.
- Jika isian hanya berbeda karena spasi, tidak ada request yang dikirim.

### 4. Menyelesaikan dan membuka kembali

- Todo aktif diselesaikan lewat `PATCH /complete`.
- Todo selesai dibuka kembali lewat `PATCH` body `{ "status": "todo" }`.
- Selama mutation berjalan, checkbox item terkait dinonaktifkan dan item ditandai `aria-busy`.
- Setelah sukses, daftar di-invalidate sehingga item berpindah section.

### 5. Menghapus todo

- Dialog menyebut judul todo dan menjelaskan bahwa penghapusan tidak dapat dipulihkan dari aplikasi.
- Backend melakukan soft delete dan mengembalikan `204`.
- Dari halaman detail, penghapusan berhasil mengarahkan pengguna kembali ke workspace.

### 6. Membuka detail

- Judul item adalah tautan ke `/workspace/:workspaceId/todos/:todoId`.
- Halaman detail menampilkan judul, status, deskripsi, workspace, tanggal dibuat/diperbarui, dan `completedAt` bila ada.
- Aksi yang tersedia: tandai selesai/buka kembali, ubah, dan hapus.

---

## D. State Halaman

| State             | Tampilan                                                          |
| ----------------- | ----------------------------------------------------------------- |
| Loading awal      | Skeleton daftar atau skeleton detail                              |
| Empty             | Ilustrasi, judul “Belum ada tugas!”, dan tombol buat              |
| Error             | Pesan error + tombol **Coba lagi**                                |
| Error dengan data | Data lama tetap tampil, error ditampilkan inline                  |
| Not found (404)   | “Tugas tidak ditemukan” + kembali ke workspace                    |
| Access denied     | “Akses ditolak” untuk 403                                         |
| Workspace mismatch | “Tugas tidak ditemukan” bila `todo.workspaceId` tidak cocok      |

Query tidak melakukan retry untuk `401`, `403`, dan `404`. Error jaringan/5xx dicoba ulang satu kali.

---

## E. Batasan dan Keputusan Teknis

1. **Satu halaman pertama saja.** Backend memakai cursor pagination. Phase 4 meminta `limit=100` dan menyimpan `hasMore`/`nextCursor`. Jika masih ada halaman berikutnya, UI menampilkan catatan bahwa navigasi halaman akan hadir pada phase berikutnya. Metadata pagination dipertahankan agar Phase 6 dapat menggantinya dengan infinite query.
2. **Reopen bukan endpoint khusus.** Backend tidak memiliki endpoint reopen. Reopen memakai `PATCH` status `todo`, yang juga mengosongkan `completedAt` di server.
3. **Soft delete.** Tidak ada restore/hard delete dari aplikasi.
4. **`cancelled` tidak ditampilkan.** Belum ada kontrol pembatalan pada Phase 4.
5. **Autentikasi end-to-end belum tersedia.** Sama seperti Phase 3, layer API siap menerima access token, tetapi login dan refresh belum dibuat. Pengujian memakai MSW.
6. **Feedback belum memakai toast global.** Feedback sukses/gagal dirender inline di section atau halaman detail.

Dokumentasi terkait:

- [Integrasi API todo](todo-api-integration.md)
- [Komponen todo](todo-components.md)
- [Testing todo](todo-testing.md)
