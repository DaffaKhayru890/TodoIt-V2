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
    todos/:todoId  Detail todo
    today
    upcoming
    completed
    tags
    labels
  *              tidak ditemukan, di dalam shell
```

`/` mengganti rute ke `/inbox`. Halaman di dalam shell berbagi `AppLayout`. `/login` dan `/register` berada di luar shell dan tidak berisi formulir. Keduanya hanya menjelaskan bahwa alur akun belum dibuat.

`/workspaces/new` membuka `CreateWorkspaceDialog` secara langsung. Menutup dialog mengarahkan pengguna ke `/inbox`, sedangkan pembuatan yang berhasil mengarahkan ke `/workspace/:workspaceId` baru. Tombol “Tambah workspace” di Primary Sidebar membuka dialog yang sama tanpa berpindah rute.

`/workspace/:workspaceId` adalah halaman detail workspace yang memuat daftar todo workspace. `/workspace/:workspaceId/todos/:todoId` adalah halaman detail todo. Judul item pada daftar menautkan ke rute tersebut. Penghapusan todo dari halaman detail mengarahkan kembali ke `/workspace/:workspaceId` dengan `replace`.

Rute placeholder lain (`today`, `upcoming`, `completed`, `tags`, `labels`) belum mengambil data. `paths.todo(workspaceId, todoId)` tersedia di `route-paths.ts` agar tautan tidak dirakit manual.

Judul dokumen diubah lewat `useDocumentTitle` menjadi `<halaman> · TodoIt`.

Akses langsung dan refresh ditangani Vite dengan mengembalikan `index.html`. Router klien lalu memilih halaman. Rute yang tidak dikenal menampilkan “Halaman tidak ditemukan” beserta tautan kembali ke inbox.
