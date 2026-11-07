import { AuthError } from '../errors/auth-error';

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_MAX_LENGTH = 128;

/**
 * Password diperiksa apa adanya: tidak di-trim dan tidak diubah kapitalisasinya,
 * karena perubahan sekecil apa pun membuat password pengguna tidak dapat dipakai.
 */
export function findPasswordViolations(password: string): readonly string[] {
  const violations: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    violations.push(`Password harus minimal ${PASSWORD_MIN_LENGTH} karakter.`);
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    violations.push(`Password tidak boleh lebih dari ${PASSWORD_MAX_LENGTH} karakter.`);
  }

  return violations;
}

export function assertPasswordPolicy(password: string): void {
  const violations = findPasswordViolations(password);

  if (violations.length > 0) {
    throw AuthError.invalidPassword(violations.join(' '));
  }
}
