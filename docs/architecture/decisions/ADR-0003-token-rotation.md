# ADR-0003: Refresh Token Rotation dan Deteksi Token Reuse

## Status
Diterima (Accepted)

## Konteks
Refresh token memiliki masa hidup yang relatif panjang (30 hari). Apabila token refresh dicuri dari perantara jaringan atau penyimpanan cookie, penyerang dapat mempertahankan akses tanpa batas kecuali ada mekanisme invalidasi otomatis dan deteksi pelanggaran.

## Keputusan
Kami menerapkan **Refresh Token Rotation dengan Concurrency Control dan Automatic Reuse Detection**:
1. **Satu Token untuk Satu Rotasi (Single-Use Token)**:
   - Setiap kali endpoint `/api/v1/auth/refresh` dipanggil dengan token valid, token lama langsung ditandai `consumed_at = now()`.
   - Token refresh baru dibuat dan dicatat pada database dengan referensi `replaced_by_token_id`.
2. **Transaksi Atomik dan Row Locking**:
   - Seluruh proses rotasi dieksekusi di dalam satu database transaction PostgreSQL.
   - Menggunakan query `SELECT ... FOR UPDATE` pada baris `refresh_tokens` berdasarkan `token_hash`. Hal ini mencegah race condition saat dua request refresh tiba bersamaan (misal parallel fetch di browser).
3. **Deteksi Token Reuse (Pencurian Token)**:
   - Apabila token yang sudah ditandai `consumed_at` atau memiliki `replaced_by_token_id` kembali dipresentasikan ke endpoint refresh:
     - Sistem mendeteksi kondisi ini sebagai indikasi pencurian token.
     - Di dalam transaksi yang sama, seluruh session milik user tersebut langsung di-revoke (`revoked_at = now()`).
     - Event dicatat ke security log dengan menyembunyikan token plaintext.
     - Mengembalikan error generik `INVALID_REFRESH_TOKEN` (HTTP 401) tanpa membocorkan rincian deteksi kepada klien/penyerang.

## Konsekuensi
### Positif
- Jendela eksploitasi token refresh yang dicuri sangat sempit: begitu salah satu pihak (korban atau penyerang) melakukan rotasi, pihak kedua yang mencoba memakai token lama akan langsung memicu pencabutan seluruh session.
- Tidak terjadi inkonsistensi status token akibat balapan request paralel karena dikontrol dengan row-level lock.

### Negatif / Mitigasi
- Pengguna yang sah mungkin ter-logout jika terjadi duplikasi request refresh akibat jaringan yang tidak stabil dan memicu reuse detection; hal ini merupakan trade-off keamanan yang standar untuk zero-trust session management.
