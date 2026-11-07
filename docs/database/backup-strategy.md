# Backup

`infra/scripts/backup-database.sh` menjalankan `pg_dump` plain SQL ke path yang diberikan. Butuh `pg_dump` dan password dari environment, bukan dari file di repo.

Enkripsi dan penyimpanan di lokasi terpisah adalah tanggung jawab operator. Script tidak mengunggah backup.

Retensi backup tidak dipaksa kode. Usulan awal, bersifat provisional dan belum disetujui sebagai komitmen: simpan dump harian 14 hari. RPO usulan provisional 24 jam bila backup harian. RTO usulan provisional beberapa jam untuk satu host, bukan angka kontrak.
