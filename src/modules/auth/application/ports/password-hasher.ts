/**
 * Abstraksi hashing password. Use case tidak mengenal Bun.password maupun
 * algoritma specifics; implementasinya ada di infrastructure layer.
 */
export interface PasswordHasher {
  hash(password: string): Promise<string>;

  /**
   * Mengembalikan false untuk password salah maupun hash yang tidak dapat dibaca.
   * Implementasi tidak boleh melempar exception, karena use case login memakai
   * verifikasi terhadap hash dummy saat user tidak ditemukan supaya waktu respons
   * tidak membedakan email terdaftar dan tidak terdaftar.
   */
  verify(password: string, passwordHash: string): Promise<boolean>;
}
