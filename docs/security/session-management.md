# Manajemen Sesi (Session Management)

Dokumen ini menjelaskan strategi manajemen sesi, dukungan multi-perangkat, dan pencabutan sesi (session revocation) pada Todo Backend Application.

---

## 1. Konsep Sesi Multi-Perangkat (Multi-Session Support)

Setiap panggilan login yang berhasil membuka satu record sesi baru pada tabel `auth_sessions`:
- Satu pengguna dapat memiliki beberapa sesi aktif secara bersamaan (misal: login di laptop kerja, ponsel pribadi, dan tablet).
- Setiap sesi memiliki siklus hidup independen dan berasosiasi dengan rantai refresh token masing-masing.
- Nilai User-Agent disimpan (maksimal 512 karakter) untuk keperluan audit.

---

## 2. Masa Berlaku Sesi (Session Expiration)

- **Masa Hidup Sesi**: Default 30 hari (2.592.000 detik).
- Masa berlaku sesi dihitung sejak login pertama kali dan tidak diperpanjang secara otomatis tanpa batas waktu (fixed session expiry), sehingga mengharuskan pengguna melakukan re-autentikasi berkala demi keamanan.
- Sesi yang telah melewati `expires_at` otomatis ditolak oleh middleware maupun use case refresh.

---

## 3. Pencabutan Sesi (Session Revocation)

Sesi dapat dicabut (`revoked_at !== null`) melalui dua mekanisme:
1. **Pencabutan Sukarela (Logout)**:
   - Pengguna memanggil `POST /api/v1/auth/logout`.
   - Sesi yang berasosiasi dengan cookie refresh token tersebut langsung dicabut.
   - Sesi di perangkat lain tetap aktif dan tidak terganggu.
2. **Pencabutan Darurat (Token Reuse Detection)**:
   - Terjadi saat sistem mendeteksi token refresh lama digunakan kembali.
   - Seluruh sesi milik user terkait dicabut serentak untuk menghentikan akses penyerang.

Begitu sesi dicabut, seluruh permintaan menggunakan Access Token yang membawa `sid` sesi tersebut akan langsung ditolak dengan status **HTTP 401 (SESSION_REVOKED)**, bahkan jika masa berlaku JWT-nya sendiri belum habis secara matematis.
