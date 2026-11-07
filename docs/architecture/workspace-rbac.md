# RBAC Workspace

Kebijakan terpusat ada di `WorkspaceAuthorizationPolicy`. `WorkspaceAuthorizationService` membaca membership terbaru lewat `findWorkspaceWithRole`. Handler HTTP tidak memutuskan role.

| Aksi | Owner | Admin | Member |
|---|---|---|---|
| Lihat workspace dan anggota | ya | ya | ya |
| Ubah atau arsipkan workspace | ya | tidak | tidak |
| Undang member | ya | ya | tidak |
| Undang admin | ya | tidak | tidak |
| Lihat, kirim ulang, cabut undangan | semua | hanya undangan member buatannya | tidak |
| Ubah role admin/member | ya | tidak | tidak |
| Hapus admin | ya | tidak | tidak |
| Hapus member | ya | ya | tidak |
| Keluar | setelah transfer | ya | ya |
| Transfer kepemilikan | ya | tidak | tidak |
| Kelola Todo | ya | ya | ya |
| Kelola katalog tag dan label | ya | ya | tidak |
| Assign tag/label dan reminder | ya | ya | ya |

Workspace yang diarsipkan dan pengguna yang bukan anggota menerima `WORKSPACE_ACCESS_DENIED` (HTTP 404) agar daftar workspace orang lain tidak bisa dienumerasi. Penolakan role pada workspace yang memang diketahui memakai HTTP 403.

Access token membawa identitas sesi. Setiap permintaan Todo dan kolaborasi memeriksa `workspace_members` lagi, sehingga penghapusan anggota langsung menutup akses tanpa menunggu token kedaluwarsa.
