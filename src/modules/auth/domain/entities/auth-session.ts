/**
 * Session mewakili satu perangkat/browser. Aturan kesiapan session hidup di sini
 * (bukan di query) supaya use case dapat diuji dengan data in-memory.
 */
export interface AuthSession {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: Date;
  readonly expiresAt: Date;
  readonly lastUsedAt: Date | null;
  readonly revokedAt: Date | null;
  readonly userAgent: string | null;
}

export function isSessionExpired(session: AuthSession, now: Date): boolean {
  return session.expiresAt.getTime() <= now.getTime();
}

export function isSessionRevoked(session: AuthSession): boolean {
  return session.revokedAt !== null;
}

export function isSessionActive(session: AuthSession, now: Date): boolean {
  return !isSessionRevoked(session) && !isSessionExpired(session, now);
}
