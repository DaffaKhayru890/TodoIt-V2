# Keamanan Password (Password Security)

Dokumen ini menjelaskan kebijakan dan implementasi teknis keamanan password pada Todo Backend Application.

---

## 1. Algoritma Hashing: Argon2id

Sistem menggunakan algoritma **Argon2id** melalui runtime `Bun.password`:
- **Algoritma Pemenang Password Hashing Competition (PHC)**: Argon2id menggabungkan ketahanan terhadap serangan GPU cracking (side-channel resistance dari Argon2i) dan serangan time-memory trade-off (data dependency dari Argon2d).
- **Asynchronous Hashing**: Operasi hash dan verify dijalankan secara asynchronous non-blocking agar tidak menghentikan event loop server.
- **Salt Kriptografis Otomatis**: Setiap proses hashing menghasilkan salt acak unik yang disematkan ke dalam string hash modular.

---

## 2. Kebijakan Password (Password Policy)

Aturan yang ditegakkan pada domain layer:
1. **Panjang Minimal**: 12 karakter. Kebijakan ini memastikan entropi yang cukup tinggi terhadap serangan brute-force online dan offline.
2. **Panjang Maksimal**: 128 karakter. Mencegah serangan Denial of Service (DoS) melalui payload password berukuran gigantik yang membebani komputasi hashing.
3. **Tanpa Modifikasi Karakter**: Karakter password tidak pernah di-trim atau diubah secara diam-diam.
4. **Pencegahan Kebocoran**:
   - Password plaintext tidak pernah disimpan di database.
   - Password plaintext tidak pernah dicatat ke dalam file log atau access log server.
   - `passwordHash` diisolasi di modul autentikasi dan tidak pernah dikembalikan ke klien API.

---

## 3. Pencegahan Timing Attack (Timing Equalization)

Ketika klien melakukan login dengan email yang tidak terdaftar, sistem mengeksekusi verifikasi password terhadap hash dummy konstan (`TIMING_EQUALIZER_HASH`) sebelum melempar error:
```typescript
if (!user) {
  await this.passwords.verify(input.password, TIMING_EQUALIZER_HASH);
  throw AuthError.invalidCredentials();
}
```
Pendekatan ini memastikan waktu respons server identik antara kasus email terdaftar dengan password salah vs email tidak terdaftar, sehingga penyerang tidak dapat melakukan enumerasi email melalui analisis variasi waktu latensi (timing attack).
