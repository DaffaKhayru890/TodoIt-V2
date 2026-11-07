import type { User } from '../../src/modules/auth/domain/entities/user';
import type { AuthSession } from '../../src/modules/auth/domain/entities/auth-session';
import type { RefreshToken } from '../../src/modules/auth/domain/entities/refresh-token';
import type {
  CreateNewUserCommand,
  UserRepository
} from '../../src/modules/auth/domain/repositories/user-repository';
import type {
  AuthSessionRepository,
  RefreshRotationOutcome,
  RevokeSessionCommand,
  RotateRefreshTokenCommand,
  StartedSession,
  StartSessionCommand
} from '../../src/modules/auth/domain/repositories/auth-session-repository';
import type { Email } from '../../src/modules/auth/domain/value-objects/email';
import { AuthError } from '../../src/modules/auth/domain/errors/auth-error';

export class InMemoryAuthRepository implements UserRepository, AuthSessionRepository {
  users: User[] = [];
  sessions: AuthSession[] = [];
  refreshTokens: RefreshToken[] = [];
  failOnCreateUser = false;

  async findByEmail(email: Email): Promise<User | null> {
    const user = this.users.find((u) => u.email.value === email.value);
    return user ?? null;
  }

  async findById(userId: string): Promise<User | null> {
    const user = this.users.find((u) => u.id === userId);
    return user ?? null;
  }

  async createNewUser(command: CreateNewUserCommand): Promise<User> {
    if (this.failOnCreateUser) {
      throw new Error('Database connection lost');
    }

    if (this.users.some((u) => u.email.value === command.email.value)) {
      throw AuthError.emailAlreadyExists();
    }

    const newUser: User = {
      id: crypto.randomUUID(),
      email: command.email,
      displayName: command.displayName,
      passwordHash: command.passwordHash,
      createdAt: command.now,
      updatedAt: command.now
    };

    this.users.push(newUser);
    return newUser;
  }

  async startSession(command: StartSessionCommand): Promise<StartedSession> {
    const sessionId = crypto.randomUUID();
    const tokenId = crypto.randomUUID();

    const session: AuthSession = {
      id: sessionId,
      userId: command.userId,
      createdAt: command.now,
      expiresAt: command.sessionExpiresAt,
      lastUsedAt: null,
      revokedAt: null,
      userAgent: command.userAgent
    };

    const refreshToken: RefreshToken = {
      id: tokenId,
      sessionId,
      tokenHash: command.hash,
      expiresAt: command.tokenExpiresAt,
      consumedAt: null,
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: command.now
    };

    this.sessions.push(session);
    this.refreshTokens.push(refreshToken);

    return { session, refreshToken };
  }

  async findSessionById(sessionId: string): Promise<AuthSession | null> {
    const session = this.sessions.find((s) => s.id === sessionId);
    return session ?? null;
  }

  async markSessionUsed(sessionId: string, now: Date): Promise<void> {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (session) {
      (session as any).lastUsedAt = now;
    }
  }

  async rotateRefreshToken(command: RotateRefreshTokenCommand): Promise<RefreshRotationOutcome> {
    const token = this.refreshTokens.find((t) => t.tokenHash === command.presentedHash);
    if (!token) {
      return { status: 'unknown-token' };
    }

    // Deteksi reuse
    if (token.consumedAt !== null || token.replacedByTokenId !== null) {
      const session = this.sessions.find((s) => s.id === token.sessionId);
      const userId = session?.userId ?? token.sessionId;

      let revokedSessionCount = 0;
      for (const s of this.sessions) {
        if (s.userId === userId && s.revokedAt === null) {
          (s as any).revokedAt = command.now;
          revokedSessionCount++;
        }
      }

      return {
        status: 'reused',
        userId,
        revokedSessionCount
      };
    }

    const session = this.sessions.find((s) => s.id === token.sessionId);
    if (!session) {
      return { status: 'unknown-token' };
    }

    if (token.revokedAt !== null || session.revokedAt !== null) {
      return { status: 'session-revoked' };
    }

    if (session.expiresAt.getTime() <= command.now.getTime()) {
      return { status: 'session-expired' };
    }

    if (token.expiresAt.getTime() <= command.now.getTime()) {
      return { status: 'token-expired' };
    }

    const replacementId = crypto.randomUUID();
    const replacement: RefreshToken = {
      id: replacementId,
      sessionId: session.id,
      tokenHash: command.replacementHash,
      expiresAt: command.tokenExpiresAt,
      consumedAt: null,
      revokedAt: null,
      replacedByTokenId: null,
      createdAt: command.now
    };

    (token as any).consumedAt = command.now;
    (token as any).replacedByTokenId = replacementId;
    (session as any).lastUsedAt = command.now;

    this.refreshTokens.push(replacement);

    return {
      status: 'rotated',
      session,
      previousTokenId: token.id,
      replacement
    };
  }

  async revokeSessionByRefreshToken(command: RevokeSessionCommand): Promise<boolean> {
    const token = this.refreshTokens.find((t) => t.tokenHash === command.hash);
    if (!token) {
      return false;
    }

    const session = this.sessions.find((s) => s.id === token.sessionId);
    if (session) {
      (session as any).revokedAt = command.now;
    }

    for (const t of this.refreshTokens) {
      if (t.sessionId === token.sessionId) {
        (t as any).revokedAt = command.now;
      }
    }

    return true;
  }
}
