/**
 * Refresh token disimpan sebagai hash; entitas ini tidak pernah memuat token
 * plaintext. `consumedAt` menandai token yang sudah dirotasi, dan
 * `replacedByTokenId` menunjuk token hasil rotasi.
 */
export interface RefreshToken {
  readonly id: string;
  readonly sessionId: string;
  readonly tokenHash: string;
  readonly expiresAt: Date;
  readonly consumedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly replacedByTokenId: string | null;
  readonly createdAt: Date;
}

export function isRefreshTokenExpired(token: RefreshToken, now: Date): boolean {
  return token.expiresAt.getTime() <= now.getTime();
}

export function isRefreshTokenConsumed(token: RefreshToken): boolean {
  return token.consumedAt !== null;
}

export function isRefreshTokenRevoked(token: RefreshToken): boolean {
  return token.revokedAt !== null;
}

export function isRefreshTokenUsable(token: RefreshToken, now: Date): boolean {
  return !isRefreshTokenConsumed(token) && !isRefreshTokenRevoked(token) && !isRefreshTokenExpired(token, now);
}
