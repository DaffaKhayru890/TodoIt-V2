import type { Email } from '../value-objects/email';
import type { User } from '../entities/user';

export interface CreateNewUserCommand {
  readonly email: Email;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly now: Date;
}

/**
 * Kontrak repository user. Implementasinya ada di infrastructure layer; use case
 * hanya melihat interface ini sehingga dapat diuji dengan implementasi in-memory.
 */
export interface UserRepository {
  findByEmail(email: Email): Promise<User | null>;
  findById(userId: string): Promise<User | null>;

  /**
   * Menyimpan user baru. Implementasi WAJIB memetakan pelanggaran unique pada
   * email ke AuthError 'EMAIL_ALREADY_EXISTS', termasuk ketika konflik terjadi
   * karena balapan dua request registrasi bersamaan.
   */
  createNewUser(command: CreateNewUserCommand): Promise<User>;
}
