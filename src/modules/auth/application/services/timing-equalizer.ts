/**
 * Hash dummy untuk verifikasi saat email tidak terdaftar. Plaintext-nya tidak
 * pernah diketahui siapa pun; tuannya hanya membuat waktu respons login hampir
 * sama untuk kasus "email tidak ada" dan "password salah".
 */
export const TIMING_EQUALIZER_HASH =
  '$argon2id$v=19$m=65536,t=2,p=1$G3rBfSBqj+h24sjpML4n/1lYhX47NQMwZSH1UzIudh0$oc1gEHZfYJgkks8TEtEgbdpZxLwCsPKjxGoHC/MGh04';
