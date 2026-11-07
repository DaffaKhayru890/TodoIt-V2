import type { User } from '../../domain/entities/user';
import type { AuthSession } from '../../domain/entities/auth-session';
import type { RefreshToken } from '../../domain/entities/refresh-token';
import { toEmail } from '../../domain/value-objects/email';
import type { authSessions, refreshTokens, users } from '../persistence/auth.schema';

export function toUserEntity(row: typeof users.$inferSelect): User {
  return {
    id: row.id,
    email: toEmail(row.email),
    displayName: row.displayName,
    passwordHash: row.passwordHash,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export function toAuthSessionEntity(row: typeof authSessions.$inferSelect): AuthSession {
  return {
    id: row.id,
    userId: row.userId,
    createdAt: row.createdAt,
    expiresAt: row.expiresAt,
    lastUsedAt: row.lastUsedAt,
    revokedAt: row.revokedAt,
    userAgent: row.userAgent
  };
}

export function toRefreshTokenEntity(row: typeof refreshTokens.$inferSelect): RefreshToken {
  return {
    id: row.id,
    sessionId: row.sessionId,
    tokenHash: row.tokenHash,
    expiresAt: row.expiresAt,
    consumedAt: row.consumedAt,
    revokedAt: row.revokedAt,
    replacedByTokenId: row.replacedByTokenId,
    createdAt: row.createdAt
  };
}
