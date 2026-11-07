import type { AuthenticatedUser } from './authenticated-user';

export interface RegisteredUserDto {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
  readonly createdAt: Date;
}

export interface LoginResult {
  readonly user: AuthenticatedUser;
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  /** Umur access token dalam detik, cocok dengan klaim `exp` JWT. */
  readonly expiresIn: number;
  /** Refresh token plaintext; hanya hidup sampai presentation menuliskannya ke cookie. */
  readonly refreshCookieToken: string;
  readonly refreshCookieExpiresAt: Date;
}

export interface RefreshResult {
  readonly accessToken: string;
  readonly tokenType: 'Bearer';
  readonly expiresIn: number;
  readonly refreshCookieToken: string;
  readonly refreshCookieExpiresAt: Date;
}
