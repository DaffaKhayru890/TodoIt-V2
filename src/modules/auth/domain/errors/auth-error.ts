import { ApplicationError } from '../../../../shared/domain/errors/application-error';

/**
 * Kode error domain authentication. Nilai ini stabil dan menjadi kontrak API:
 * presentation layer memetakannya ke HTTP status, klien boleh bergantung padanya.
 */
export const AUTH_ERROR_CODES = [
  'INVALID_EMAIL',
  'INVALID_PASSWORD',
  'VALIDATION_ERROR',
  'EMAIL_ALREADY_EXISTS',
  'INVALID_CREDENTIALS',
  'UNAUTHORIZED',
  'INVALID_ACCESS_TOKEN',
  'INVALID_REFRESH_TOKEN',
  'SESSION_EXPIRED',
  'SESSION_REVOKED',
  'USER_NOT_FOUND'
] as const;

export type AuthErrorCode = (typeof AUTH_ERROR_CODES)[number];

/**
 * Domain error tanpa dependensi HTTP. Pesan yang melekat pada error selalu aman
 * ditampilkan ke klien: tidak memuat hash, token, maupun informasi schema.
 */
export class AuthError extends ApplicationError {
  readonly code: AuthErrorCode;

  private constructor(code: AuthErrorCode, message: string) {
    super(code, message);
    this.code = code;
  }

  static invalidEmail(message = 'Email yang diberikan tidak valid.'): AuthError {
    return new AuthError('INVALID_EMAIL', message);
  }

  static invalidPassword(message: string): AuthError {
    return new AuthError('INVALID_PASSWORD', message);
  }

  static invalidDisplayName(message: string): AuthError {
    return new AuthError('VALIDATION_ERROR', message);
  }

  static emailAlreadyExists(): AuthError {
    return new AuthError('EMAIL_ALREADY_EXISTS', 'Email sudah terdaftar.');
  }

  /**
   * Pesan yang sama dipakai untuk email tidak ditemukan dan password salah,
   * supaya respons login tidak membocorkan email mana yang sudah terdaftar.
   */
  static invalidCredentials(): AuthError {
    return new AuthError('INVALID_CREDENTIALS', 'Invalid email or password');
  }

  static unauthorized(message = 'Autentikasi diperlukan.'): AuthError {
    return new AuthError('UNAUTHORIZED', message);
  }

  static invalidAccessToken(): AuthError {
    return new AuthError('INVALID_ACCESS_TOKEN', 'Access token tidak valid atau sudah kedaluwarsa.');
  }

  static invalidRefreshToken(): AuthError {
    return new AuthError('INVALID_REFRESH_TOKEN', 'Refresh token tidak valid.');
  }

  static sessionExpired(): AuthError {
    return new AuthError('SESSION_EXPIRED', 'Session sudah kedaluwarsa.');
  }

  static sessionRevoked(): AuthError {
    return new AuthError('SESSION_REVOKED', 'Session sudah dicabut.');
  }

  static userNotFound(): AuthError {
    return new AuthError('USER_NOT_FOUND', 'Pengguna tidak ditemukan.');
  }
}
