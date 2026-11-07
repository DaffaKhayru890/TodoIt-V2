# Routing

Router memakai React Router 8: `BrowserRouter`, `Routes`, `Route`, `NavLink`, dan `Outlet`. Konstanta path ada di `src/app/router/route-paths.ts`.

```text
/login
/register
/
  inbox
  search
  settings
  workspaces/new
  workspace/:workspaceId
    index        All Tasks
    today
    upcoming
    completed
    tags
    labels
  *              tidak ditemukan, di dalam shell
```

`/` mengganti rute ke `/inbox`. Halaman di dalam shell berbagi `AppLayout`. `/login` dan `/register` berada di luar shell dan tidak berisi formulir. Keduanya hanya menjelaskan bahwa alur akun belum dibuat.

Halaman placeholder menampilkan judul, deskripsi, dan badge “Phase berikutnya”. All Tasks juga menampilkan `EmptyState` sebagai contoh kosong, tanpa data todo.

Judul dokumen diubah lewat `useDocumentTitle` menjadi `<halaman> · TodoIt`.

Akses langsung dan refresh ditangani Vite dengan mengembalikan `index.html`. Router klien lalu memilih halaman. Rute yang tidak dikenal menampilkan “Halaman tidak ditemukan” beserta tautan kembali ke inbox.
