import type { PasswordHasher } from '../../application/ports/password-hasher';

export class BunPasswordHasher implements PasswordHasher {
  async hash(password: string): Promise<string> {
    return Bun.password.hash(password, {
      algorithm: 'argon2id'
    });
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    try {
      return await Bun.password.verify(password, passwordHash);
    } catch {
      return false;
    }
  }
}
