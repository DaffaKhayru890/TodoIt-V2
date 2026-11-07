import { describe, expect, test } from 'bun:test';
import { LogoutUser } from '../../../src/modules/auth/application/use-cases/logout-user';
import { InMemoryAuthRepository } from '../../helpers/in-memory-auth-repository';
import type { RefreshTokenGenerator } from '../../../src/modules/auth/application/ports/refresh-token-generator';
import type { Clock } from '../../../src/modules/auth/application/ports/clock';

const fakeTokenGenerator: RefreshTokenGenerator = {
  generate: async () => ({ token: 'dummy', hash: 'dummy_hash' }),
  hash: async (t: string) => `hash_of_${t}`
};

const fixedClock: Clock = {
  now: () => new Date('2026-01-01T00:00:00.000Z')
};

describe('LogoutUser use case', () => {
  test('logout session aktif mencabut session dan token', async () => {
    const repo = new InMemoryAuthRepository();
    const now = fixedClock.now();
    const future = new Date(now.getTime() + 2592000 * 1000);

    const { session, refreshToken } = await repo.startSession({
      userId: 'user-1',
      hash: 'hash_of_active_token',
      sessionExpiresAt: future,
      tokenExpiresAt: future,
      userAgent: null,
      now
    });

    const logout = new LogoutUser(repo, fakeTokenGenerator, fixedClock);

    await logout.execute({ refreshToken: 'active_token' });

    expect(session.revokedAt).not.toBeNull();
    expect(refreshToken.revokedAt).not.toBeNull();
  });

  test('logout dengan token invalid atau tidak ditemukan tidak melempar error (idempoten)', async () => {
    const repo = new InMemoryAuthRepository();
    const logout = new LogoutUser(repo, fakeTokenGenerator, fixedClock);

    // Tanpa exception
    await logout.execute({ refreshToken: 'unknown_token' });
    await logout.execute({ refreshToken: null });
    await logout.execute({ refreshToken: undefined });
  });

  test('logout dua kali berturut-turut aman dan idempoten', async () => {
    const repo = new InMemoryAuthRepository();
    const now = fixedClock.now();
    const future = new Date(now.getTime() + 2592000 * 1000);

    await repo.startSession({
      userId: 'user-1',
      hash: 'hash_of_token',
      sessionExpiresAt: future,
      tokenExpiresAt: future,
      userAgent: null,
      now
    });

    const logout = new LogoutUser(repo, fakeTokenGenerator, fixedClock);

    await logout.execute({ refreshToken: 'token' });
    await logout.execute({ refreshToken: 'token' });
  });
});
