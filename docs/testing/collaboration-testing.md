# Pengujian Kolaborasi

```bash
bun run typecheck
bun test --env-file=.env.test
```

| Berkas | Isi |
|---|---|
| `tests/unit/workspace/collaboration.test.ts` | Domain, buat/terima/tolak/kirim ulang/cabut, anggota, transfer, matriks role, isi email |
| `tests/integration/collaboration-endpoints.test.ts` | `app.handle`, 401, 201 tanpa token, accept, decline, anggota, transfer, OpenAPI |
| `tests/integration/collaboration-database.test.ts` | Postgres: unique pending, check role, satu owner, accept bersamaan, transfer |

Unit test memakai `FixedClock`, `SequenceInvitationTokenGenerator`, dan `FakeInvitationEmailSender`. Tidak ada email sungguhan.

`InMemoryWorkspaceUnitOfWork` mengantri transaksi supaya dua accept tidak saling menyisip. Tes database mengulang skenario itu pada PostgreSQL dengan `SELECT … FOR UPDATE`.

Hasil angka ada di laporan Phase 5 setelah suite dijalankan. Jangan menyalin angka lama dari Phase 4.
