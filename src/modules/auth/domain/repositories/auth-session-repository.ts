import type { AuthSession } from '../entities/auth-session';
import type { RefreshToken } from '../entities/refresh-token';

export interface StartSessionCommand {
  readonly userId: string;
  readonly hash: string;
  readonly sessionExpiresAt: Date;
  readonly tokenExpiresAt: Date;
  readonly userAgent: string | null;
  readonly now: Date;
}

export interface StartedSession {
  readonly session: AuthSession;
  readonly refreshToken: RefreshToken;
}

export interface RotateRefreshTokenCommand {
  readonly presentedHash: string;
  readonly replacementHash: string;
  readonly tokenExpiresAt: Date;
  readonly now: Date;
}

/**
 * Hasil rotasi dinyatakan sebagai data, bukan exception, supaya use case dapat
 * memetakan setiap kasus ke error autentikasi yang tepat dan mudah diuji.
 *
 * - 'rotated': token lama ditandai consumed dan token baru tersimpan.
 * - 'unknown-token': hash tidak dikenal (termasuk token dari environment lain).
 * - 'token-expired' / 'session-expired': masa berlaku habis.
 * - 'session-revoked': session sudah dicabut (logout atau reuse detection).
 * - 'reused': token lama dipakai ulang. Deteksi ini sekaligus mencabut seluruh
 *   session milik user terkait di dalam transaksi yang sama.
 */
export type RefreshRotationOutcome =
  | {
      readonly status: 'rotated';
      readonly session: AuthSession;
      readonly previousTokenId: string;
      readonly replacement: RefreshToken;
    }
  | { readonly status: 'unknown-token' }
  | { readonly status: 'token-expired' }
  | { readonly status: 'session-expired' }
  | { readonly status: 'session-revoked' }
  | { readonly status: 'reused'; readonly userId: string; readonly revokedSessionCount: number };

export interface RevokeSessionCommand {
  readonly hash: string;
  readonly now: Date;
}

/**
 * Session dan refresh token adalah satu aggregate: keduanya selalu berubah
 * bersama dalam satu transaksi database, jadi keduanya dilayani satu repository.
 */
export interface AuthSessionRepository {
  startSession(command: StartSessionCommand): Promise<StartedSession>;
  findSessionById(sessionId: string): Promise<AuthSession | null>;
  markSessionUsed(sessionId: string, now: Date): Promise<void>;
  rotateRefreshToken(command: RotateRefreshTokenCommand): Promise<RefreshRotationOutcome>;

  /** Logout: idempoten, mengembalikan false bila token tidak dikenal. */
  revokeSessionByRefreshToken(command: RevokeSessionCommand): Promise<boolean>;
}
