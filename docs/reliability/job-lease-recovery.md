# Pemulihan Lease

Lease default 60 detik. Claim mengisi `locked_by`, `locked_at`, dan `lock_expires_at`. Heartbeat memperpanjangnya bila worker masih pemilik dan lease belum habis.

Bila proses crash, baris tetap `processing` sampai `lock_expires_at`. Query klaim berikutnya mengikutsertakan baris itu. Worker baru menambah attempts dan memasang lease baru.

Shutdown rapi mengubah `lock_expires_at` milik worker itu menjadi sekarang tanpa mengubah status menjadi completed. Worker lain dapat segera mengklaim sisa pekerjaan.

Dua worker tidak memproses baris yang sama selama lease masih dipegang, karena `FOR UPDATE SKIP LOCKED` melewati baris yang sedang dikunci transaksi lain dan complete menolak worker yang bukan pemilik.
