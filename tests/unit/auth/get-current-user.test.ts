import { describe, expect, test } from 'bun:test';
import { GetCurrentUser } from '../../../src/modules/auth/application/use-cases/get-current-user';
import { RegisterUser } from '../../../src/modules/auth/application/use-cases/register-user';
import { InMemoryAuthRepository } from '../../helpers/in-memory-auth-repository';
import type { PasswordHasher } from '../../../src/modules/auth/application/ports/password-hasher';
import type { AccessTokenService } from '../../../src/modules/auth/application/ports/access-token-service';
import type { Clock } from '../../../src/modules/auth/application/ports/clock';
import { AuthError } from '../../../src/modules/auth/domain/errors/auth-error';

const fakeHasher: PasswordHasher = {
  hash: async (password: string) => `hashed_${password}`,
  verify: async (pwd, hash) => hash === `hashed_${pwd}`
};

const fakeAccessTokenService: AccessTokenService = {
  generate: async () => ({ token: 'dummy', expiresAt: new Date() }),
  verify: async (token: string) => {
    if (token === 'valid_token') {
      return { userId: 'user-1', sessionId: 'session-1' };
    }
    if (token === 'unknown_user_token') {
      return { userId: 'nonexistent-user', sessionId: 'session-1' };
    }
    return null;
  }
};

const fixedClock: Clock = {
  now: () => new Date('2026-01-01T00:00:00.000Z')
};

describe('GetCurrentUser use case', () => {
  test('access token valid mengembalikan data user dan memperbarui lastUsedAt', async () => {
    const repo = new InMemoryAuthRepository();
    const register = new RegisterUser(repo, fakeHasher, fixedClock);
    const registered = await register.execute({
      email: 'dev@example.com',
      displayName: 'Dev',
      password: 'a-secure-long-passphrase'
    });

    const now = fixedClock.now();
    const future = new Date(now.getTime() + 2592000 * 1000);

    // Buat session
    repo.sessions.push({
      id: 'session-1',
      userId: registered.id,
      createdAt: now,
      expiresAt: future,
      lastUsedAt: null,
      revokedAt: null,
      userAgent: null
    });

    const customTokenService: AccessTokenService = {
      generate: async () => ({ token: 't', expiresAt: new Date() }),
      verify: async (t) => t === 'jwt_token' ? { userId: registered.id, sessionId: 'session-1' } : null
    };

    const me = new GetCurrentUser(repo, repo, customTokenService, fixedClock);

    const result = await me.execute({ authorizationHeader: 'Bearer jwt_token' });

    expect(result.id).toBe(registered.id);
    expect(result.email).toBe('dev@example.com');
    expect(result.displayName).toBe('Dev');

    // Pastikan session.lastUsedAt diperbarui
    const session = repo.sessions[0];
    expect(session?.lastUsedAt).toEqual(now);
  });

  test('token expired atau invalid melempar INVALID_ACCESS_TOKEN', async () => {
    const repo = new InMemoryAuthRepository();
    const me = new GetCurrentUser(repo, repo, fakeAccessTokenService, fixedClock);

    await expect(me.execute({ authorizationHeader: 'Bearer bad_token' })).rejects.toThrow(
      'Access token tidak valid atau sudah kedaluwarsa.'
    );
    await expect(me.execute({ authorizationHeader: null })).rejects.toThrow(AuthError);
  });

  test('session revoked melempar SESSION_REVOKED', async () => {
    const repo = new InMemoryAuthRepository();
    const now = fixedClock.now();
    const future = new Date(now.getTime() + 2592000 * 1000);

    repo.sessions.push({
      id: 'session-1',
      userId: 'user-1',
      createdAt: now,
      expiresAt: future,
      lastUsedAt: null,
      revokedAt: now,
      userAgent: null
    });

    const me = new GetCurrentUser(repo, repo, fakeAccessTokenService, fixedClock);

    await expect(me.execute({ authorizationHeader: 'Bearer valid_token' })).rejects.toThrow(
      'Session sudah dicabut.'
    );
  });

  test('session expired melempar SESSION_EXPIRED', async () => {
    const repo = new InMemoryAuthRepository();
    const past = new Date('2025-01-01T00:00:00.000Z');

    repo.sessions.push({
      id: 'session-1',
      userId: 'user-1',
      createdAt: past,
      expiresAt: past,
      lastUsedAt: null,
      revokedAt: null,
      userAgent: null
    });

    const me = new GetCurrentUser(repo, repo, fakeAccessTokenService, fixedClock);

    await expect(me.execute({ authorizationHeader: 'Bearer valid_token' })).rejects.toThrow(
      'Session sudah kedaluwarsa.'
    );
  });

  test('user tidak ditemukan di repository melempar USER_NOT_FOUND', async () => {
    const repo = new InMemoryAuthRepository();
    const now = fixedClock.now();
    const future = new Date(now.getTime() + 2592000 * 1000);

    repo.sessions.push({
      id: 'session-1',
      userId: 'nonexistent-user',
      createdAt: now,
      expiresAt: future,
      lastUsedAt: null,
      revokedAt: null,
      userAgent: null
    });

    const me = new GetCurrentUser(repo, repo, fakeAccessTokenService, fixedClock);

    await expect(me.execute({ authorizationHeader: 'Bearer unknown_user_token' })).rejects.toThrow(
      'Pengguna tidak ditemukan.'
    );
  });
});
