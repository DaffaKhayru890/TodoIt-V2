# Audit log

Tabel `audit_events` menyimpan aktor, aksi, jenis resource, id, workspace, outcome, metadata allowlist, dan waktu. Tidak ada endpoint publik untuk mengubah atau menghapus baris.

Peristiwa yang direkam: login berhasil dan gagal, pencabutan session, arsip workspace, undangan dibuat/diterima/ditolak/dicabut, peran anggota, anggota dihapus, transfer kepemilikan, dan perubahan preferensi notifikasi.

Penulisan audit berada setelah operasi bisnis dan tidak menggagalkan permintaan bila insert audit gagal. Itu berarti audit tidak selalu satu transaksi dengan perubahan bisnis. Metadata tidak memuat password, token, atau email utuh.

Retensi default `AUDIT_LOG_RETENTION_DAYS=365`. Nilai ini adalah keputusan operasional, bukan klaim kewajiban hukum. Pembersihan audit belum dijadikan perintah terpisah dari retensi job.
