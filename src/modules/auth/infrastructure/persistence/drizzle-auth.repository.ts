import { eq } from 'drizzle-orm';
import type { DatabaseClient } from '../../../../shared/infrastructure/database/client';
import { AuthError } from '../../domain/errors/auth-error';
import type { User } from '../../domain/entities/user';
import type { AuthSession } from '../../domain/entities/auth-session';
import type {
  CreateNewUserCommand,
  UserRepository
} from '../../domain/repositories/user-repository';
import type {
  AuthSessionRepository,
  RefreshRotationOutcome,
  RevokeSessionCommand,
  RotateRefreshTokenCommand,
  StartedSession,
  StartSessionCommand
} from '../../domain/repositories/auth-session-repository';
import type { Email } from '../../domain/value-objects/email';
import { authSessions, refreshTokens, users } from './auth.schema';
import {
  toAuthSessionEntity,
  toRefreshTokenEntity,
  toUserEntity
} from '../mappers/auth.mapper';

export class DrizzleAuthRepository implements UserRepository, AuthSessionRepository {
  constructor(private readonly database: DatabaseClient) {}

  // ---------------------------------------------------------------------------
  // UserRepository
  // ---------------------------------------------------------------------------

  async findByEmail(email: Email): Promise<User | null> {
    const rows = await this.database.db
      .select()
      .from(users)
      .where(eq(users.email, email.value))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return toUserEntity(row);
  }

  async findById(userId: string): Promise<User | null> {
    const rows = await this.database.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return toUserEntity(row);
  }

  async createNewUser(command: CreateNewUserCommand): Promise<User> {
    try {
      const rows = await this.database.db
        .insert(users)
        .values({
          email: command.email.value,
          displayName: command.displayName,
          passwordHash: command.passwordHash,
          createdAt: command.now,
          updatedAt: command.now
        })
        .returning();

      const row = rows[0];
      if (!row) {
        throw new Error('Gagal menyimpan user: tidak ada data yang dikembalikan');
      }

      return toUserEntity(row);
    } catch (error: any) {
      const code = error?.code ?? error?.cause?.code;
      const message = String(error?.message ?? '') + ' ' + String(error?.cause?.message ?? '');
      if (code === '23505' || message.includes('users_email_unique') || message.includes('unique constraint')) {
        throw AuthError.emailAlreadyExists();
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // AuthSessionRepository
  // ---------------------------------------------------------------------------

  async startSession(command: StartSessionCommand): Promise<StartedSession> {
    return await this.database.db.transaction(async (tx) => {
      const sessionRows = await tx
        .insert(authSessions)
        .values({
          userId: command.userId,
          createdAt: command.now,
          expiresAt: command.sessionExpiresAt,
          userAgent: command.userAgent
        })
        .returning();

      const session = sessionRows[0];
      if (!session) {
        throw new Error('Gagal membuat auth session: baris tidak terbuat');
      }

      const tokenRows = await tx
        .insert(refreshTokens)
        .values({
          sessionId: session.id,
          tokenHash: command.hash,
          expiresAt: command.tokenExpiresAt,
          createdAt: command.now
        })
        .returning();

      const token = tokenRows[0];
      if (!token) {
        throw new Error('Gagal membuat refresh token: baris tidak terbuat');
      }

      return {
        session: toAuthSessionEntity(session),
        refreshToken: toRefreshTokenEntity(token)
      };
    });
  }

  async findSessionById(sessionId: string): Promise<AuthSession | null> {
    const rows = await this.database.db
      .select()
      .from(authSessions)
      .where(eq(authSessions.id, sessionId))
      .limit(1);

    const row = rows[0];
    if (!row) {
      return null;
    }

    return toAuthSessionEntity(row);
  }

  async markSessionUsed(sessionId: string, now: Date): Promise<void> {
    await this.database.db
      .update(authSessions)
      .set({ lastUsedAt: now })
      .where(eq(authSessions.id, sessionId));
  }

  async rotateRefreshToken(command: RotateRefreshTokenCommand): Promise<RefreshRotationOutcome> {
    return await this.database.db.transaction(async (tx) => {
      // Baris token dikunci (FOR UPDATE) untuk serialisasi request konkuren
      const tokenRows = await tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, command.presentedHash))
        .for('update');

      const tokenRow = tokenRows[0];
      if (!tokenRow) {
        return { status: 'unknown-token' };
      }

      // Deteksi reuse: token sudah pernah dikonsumsi atau digantikan
      if (tokenRow.consumedAt !== null || tokenRow.replacedByTokenId !== null) {
        // Ambil session untuk mengetahui userId
        const sessionRows = await tx
          .select()
          .from(authSessions)
          .where(eq(authSessions.id, tokenRow.sessionId));

        const userId = sessionRows[0]?.userId;

        let revokedSessionCount = 0;
        if (userId) {
          // Revoke seluruh session milik user terkait
          const revokedRows = await tx
            .update(authSessions)
            .set({ revokedAt: command.now })
            .where(eq(authSessions.userId, userId))
            .returning();

          revokedSessionCount = revokedRows.length;
        }

        return {
          status: 'reused',
          userId: userId ?? tokenRow.sessionId,
          revokedSessionCount
        };
      }

      // Ambil session terkait dengan kunci FOR UPDATE
      const sessionRows = await tx
        .select()
        .from(authSessions)
        .where(eq(authSessions.id, tokenRow.sessionId))
        .for('update');

      const sessionRow = sessionRows[0];
      if (!sessionRow) {
        return { status: 'unknown-token' };
      }

      if (tokenRow.revokedAt !== null || sessionRow.revokedAt !== null) {
        return { status: 'session-revoked' };
      }

      if (sessionRow.expiresAt.getTime() <= command.now.getTime()) {
        return { status: 'session-expired' };
      }

      if (tokenRow.expiresAt.getTime() <= command.now.getTime()) {
        return { status: 'token-expired' };
      }

      // Simpan refresh token pengganti
      const replacementRows = await tx
        .insert(refreshTokens)
        .values({
          sessionId: sessionRow.id,
          tokenHash: command.replacementHash,
          expiresAt: command.tokenExpiresAt,
          createdAt: command.now
        })
        .returning();

      const replacementRow = replacementRows[0];
      if (!replacementRow) {
        throw new Error('Gagal membuat replacement refresh token: baris tidak terbuat');
      }

      // Tandai token lama sebagai consumed dan catat rantai pengganti
      await tx
        .update(refreshTokens)
        .set({
          consumedAt: command.now,
          replacedByTokenId: replacementRow.id
        })
        .where(eq(refreshTokens.id, tokenRow.id));

      // Catat penggunaan session
      await tx
        .update(authSessions)
        .set({ lastUsedAt: command.now })
        .where(eq(authSessions.id, sessionRow.id));

      return {
        status: 'rotated',
        session: toAuthSessionEntity(sessionRow),
        previousTokenId: tokenRow.id,
        replacement: toRefreshTokenEntity(replacementRow)
      };
    });
  }

  async revokeSessionByRefreshToken(command: RevokeSessionCommand): Promise<boolean> {
    return await this.database.db.transaction(async (tx) => {
      const tokenRows = await tx
        .select()
        .from(refreshTokens)
        .where(eq(refreshTokens.tokenHash, command.hash))
        .limit(1);

      const tokenRow = tokenRows[0];
      if (!tokenRow) {
        return false;
      }

      await tx
        .update(authSessions)
        .set({ revokedAt: command.now })
        .where(eq(authSessions.id, tokenRow.sessionId));

      await tx
        .update(refreshTokens)
        .set({ revokedAt: command.now })
        .where(eq(refreshTokens.sessionId, tokenRow.sessionId));

      return true;
    });
  }
}
