import { describe, expect, test } from 'bun:test';
import { RefreshSession } from '../../../src/modules/auth/application/use-cases/refresh-session';
import { InMemoryAuthRepository } from '../../helpers/in-memory-auth-repository';
import type { AccessTokenService } from '../../../src/modules/auth/application/ports/access-token-service';
import type { RefreshTokenGenerator } from '../../../src/modules/auth/application/ports/refresh-token-generator';
import type { TokenLifetimePolicy } from '../../../src/modules/auth/application/ports/token-lifetime-policy';
import type { Clock } from '../../../src/modules/auth/application/ports/clock';
import type { SecurityLog } from '../../../src/modules/auth/application/ports/security-log';
import { AuthError } from '../../../src/modules/auth/domain/errors/auth-error';

const fakeAccessTokenService: AccessTokenService = {
  generate: async ({ userId, sessionId }) => ({
    token: `jwt_${userId}_${sessionId}`,
    expiresAt: new Date('2026-01-01T00:15:00.000Z')
  }),
  verify: async () => null
};

let tokenCounter = 1;
const fakeTokenGenerator: RefreshTokenGenerator = {
  generate: async () => {
    const id = tokenCounter++;
    return {
      token: `token_${id}`,
      hash: `hash_${id}`
    };
  },
  hash: async (t: string) => `hash_of_${t}`
};

const policy: TokenLifetimePolicy = {
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 2592000
};

const fixedClock: Clock = {
  now: () => new Date('2026-01-01T00:00:00.000Z')
};

const securityLogs: Array<{ event: string; context: any }> = [];
const fakeSecurityLog: SecurityLog = {
  warn: (event, context) => {
    securityLogs.push({ event, context });
  }
};

describe('RefreshSession use case', () => {
  test('refresh token valid menghasilkan access token baru dan rotasi cookie', async () => {
    const repo = new InMemoryAuthRepository();
    const now = fixedClock.now();
    const sessionExpiresAt = new Date(now.getTime() + 2592000 * 1000);

    const { refreshToken } = await repo.startSession({
      userId: 'user-1',
      hash: 'hash_of_initial_token',
      sessionExpiresAt,
      tokenExpiresAt: sessionExpiresAt,
      userAgent: null,
      now
    });

    const refresh = new RefreshSession(
      repo,
      fakeAccessTokenService,
      fakeTokenGenerator,
      policy,
      fixedClock,
      fakeSecurityLog
    );

    const result = await refresh.execute({ refreshToken: 'initial_token' });

    expect(result.accessToken).toBeString();
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe(900);
    expect(result.refreshCookieToken).toBeDefined();

    // Verifikasi token lama sudah consumed
    expect(refreshToken.consumedAt).not.toBeNull();
    expect(refreshToken.replacedByTokenId).not.toBeNull();
  });

  test('refresh token invalid / null melempar INVALID_REFRESH_TOKEN', async () => {
    const repo = new InMemoryAuthRepository();
    const refresh = new RefreshSession(
      repo,
      fakeAccessTokenService,
      fakeTokenGenerator,
      policy,
      fixedClock,
      fakeSecurityLog
    );

    await expect(refresh.execute({ refreshToken: null })).rejects.toThrow(AuthError);
    await expect(refresh.execute({ refreshToken: 'unknown_token' })).rejects.toThrow(AuthError);
  });

  test('refresh token expired melempar INVALID_REFRESH_TOKEN', async () => {
    const repo = new InMemoryAuthRepository();
    const now = fixedClock.now();
    const future = new Date(now.getTime() + 2592000 * 1000);
    const pastDate = new Date('2025-01-01T00:00:00.000Z');

    await repo.startSession({
      userId: 'user-1',
      hash: 'hash_of_expired_token',
      sessionExpiresAt: future,
      tokenExpiresAt: pastDate,
      userAgent: null,
      now: pastDate
    });

    const refresh = new RefreshSession(
      repo,
      fakeAccessTokenService,
      fakeTokenGenerator,
      policy,
      fixedClock,
      fakeSecurityLog
    );

    await expect(refresh.execute({ refreshToken: 'expired_token' })).rejects.toThrow(
      'Refresh token tidak valid.'
    );
  });

  test('session revoked melempar SESSION_REVOKED', async () => {
    const repo = new InMemoryAuthRepository();
    const now = fixedClock.now();
    const future = new Date(now.getTime() + 2592000 * 1000);

    const { session } = await repo.startSession({
      userId: 'user-1',
      hash: 'hash_of_revoked_token',
      sessionExpiresAt: future,
      tokenExpiresAt: future,
      userAgent: null,
      now
    });

    (session as any).revokedAt = now;

    const refresh = new RefreshSession(
      repo,
      fakeAccessTokenService,
      fakeTokenGenerator,
      policy,
      fixedClock,
      fakeSecurityLog
    );

    await expect(refresh.execute({ refreshToken: 'revoked_token' })).rejects.toThrow(
      'Session sudah dicabut.'
    );
  });

  test('reuse detection: menggunakan token lama yang sudah dirotasi merevoke seluruh session', async () => {
    const repo = new InMemoryAuthRepository();
    const now = fixedClock.now();
    const future = new Date(now.getTime() + 2592000 * 1000);

    // Buat dua session untuk user yang sama (misal 2 perangkat)
    await repo.startSession({
      userId: 'user-compromised',
      hash: 'hash_of_device_2_token',
      sessionExpiresAt: future,
      tokenExpiresAt: future,
      userAgent: 'Device 2',
      now
    });

    await repo.startSession({
      userId: 'user-compromised',
      hash: 'hash_of_token_v1',
      sessionExpiresAt: future,
      tokenExpiresAt: future,
      userAgent: 'Device 1',
      now
    });

    const refresh = new RefreshSession(
      repo,
      fakeAccessTokenService,
      fakeTokenGenerator,
      policy,
      fixedClock,
      fakeSecurityLog
    );

    // Pertama kali refresh (sukses)
    const result1 = await refresh.execute({ refreshToken: 'token_v1' });
    expect(result1.accessToken).toBeDefined();

    // Penyerang mencoba memakai kembali token lama (token_v1)
    await expect(refresh.execute({ refreshToken: 'token_v1' })).rejects.toThrow(
      'Refresh token tidak valid.'
    );

    // Seluruh session milik user-compromised harus telah dicabut
    const userSessions = repo.sessions.filter((s) => s.userId === 'user-compromised');
    expect(userSessions.length).toBe(2);
    for (const session of userSessions) {
      expect(session.revokedAt).not.toBeNull();
    }
  });
});
