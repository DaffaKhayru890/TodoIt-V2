# Staging

Staging memakai image yang sama dengan production dan database terpisah. SMTP staging tidak boleh menembak penerima produksi dari tes otomatis.

Langkah: build image, migrasi sekali lewat job rilis, jalankan API, jalankan worker, periksa `/health` dan `/ready`. Approval mengikuti environment platform. Repository ini tidak menjalankan staging.
