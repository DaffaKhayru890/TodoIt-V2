# Otorisasi Workspace

`WorkspaceAuthorizationService.authorize` menjalankan tiga langkah:

1. Membaca workspace dan role dari database.
2. Menolak workspace yang hilang, pengguna yang bukan anggota, atau workspace terarsip dengan `WORKSPACE_ACCESS_DENIED`.
3. Menanyakan `WorkspaceAuthorizationPolicy.canPerform(role, action)`.

Aksi yang lolos policy masih diperiksa di use case bila butuh data target: admin hanya mengelola undangan member yang `invitedBy`-nya dirinya; penghapusan memeriksa role target; transfer memastikan target adalah anggota.

Client tidak mengirim role aktor. Body accept tidak berisi role. Access token tidak menyimpan snapshot izin workspace.

Matriks lengkap ada di [workspace-rbac.md](../architecture/workspace-rbac.md).
