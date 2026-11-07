# Notifikasi Due Soon

Konfigurasi `TODO_DUE_SOON_OFFSETS_MINUTES`, default `1440,60`. Setiap nilai harus bilangan bulat lebih dari 0 dan tidak lebih dari 43200 menit. Duplikat ditolak. Hasil parsing diurutkan menanjak.

Default menghasilkan dua jadwal: 24 jam dan 1 jam sebelum `dueAt`.

Judul: `Upcoming Deadline`. Isi: `Your task "{judul}" is due in {jarak}.` Enam puluh menit ditulis `1 hour`, kelipatan 60 lain ditulis `N hours`, selain itu dalam menit.

Penerima adalah pembuat todo. Syarat: `dueAt` terisi, status `todo` atau `in_progress`, belum dihapus, workspace aktif, pembuat masih anggota, dan `dueAt` masih di masa depan.

Perubahan `dueAt` memakai key baru. Job lama yang payload-nya tidak sama dengan `dueAt` terkini dibatalkan saat diproses. Due date yang dihapus, todo selesai, dibatalkan, atau dihapus tidak menghasilkan due-soon.
