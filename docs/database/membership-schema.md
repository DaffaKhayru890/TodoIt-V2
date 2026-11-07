# Skema Keanggotaan

Tabel `workspace_members` tetap satu. Tidak ada tabel keanggotaan kedua.

Kolom: `id`, `workspace_id`, `user_id`, `role`, `joined_at`.

Constraint yang sudah ada: unik `(workspace_id, user_id)` dan check role `owner | admin | member`.

Phase 5 menambahkan:

```sql
CREATE UNIQUE INDEX workspace_members_one_owner_uidx
  ON workspace_members (workspace_id)
  WHERE role = 'owner';
```

Indeks daftar anggota: `(workspace_id, joined_at DESC, user_id DESC)`.

Menghapus anggota menghapus baris ini saja. `ON DELETE CASCADE` dari user atau workspace tetap perilaku Phase 2: menghapus user menghapus keanggotaannya, menghapus workspace menghapus anggota. Use case kolaborasi tidak menghapus user atau workspace.

Invariant “minimal satu owner” dijaga di use case transfer dan leave, bukan dengan trigger. Indeks parsial mencegah dua owner.
