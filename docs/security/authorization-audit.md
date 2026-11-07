# Audit otorisasi

Kebijakan tetap di application dan domain, bukan di handler. Resource workspace dan todo memeriksa membership terbaru. Notification hanya milik penerima. UUID tidak dianggap sebagai otorisasi.

Matriks ringkas: pengguna anonim ditolak 401 pada route bisnis. Bukan anggota workspace mendapat 404 sesuai kebijakan anti-enumerasi yang sudah ada. Member tidak dapat tindakan owner. Perubahan peran dibaca dari database pada permintaan berikut.

Pengujian BOLA yang sudah ada pada fase workspace, todo, dan notification tetap menjadi regresi. Phase 7 menambahkan penolakan origin dan batas body, bukan mengganti matriks peran.
