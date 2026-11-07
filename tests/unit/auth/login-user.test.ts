import { describe, expect, test } from 'bun:test';
import { LoginUser } from '../../../src/modules/auth/application/use-cases/login-user';
import { RegisterUser } from '../../../src/modules/auth/application/use-cases/register-user';
import { InMemoryAuthRepository } from '../../helpers/in-memory-auth-repository';
import type { PasswordHasher } from '../../../src/modules/auth/application/ports/password-hasher';
import type { AccessTokenService } from '../../../src/modules/auth/application/ports/access-token-service';
import type { RefreshTokenGenerator } from '../../../src/modules/auth/application/ports/refresh-token-generator';
import type { TokenLifetimePolicy } from '../../../src/modules/auth/application/ports/token-lifetime-policy';
import type { Clock } from '../../../src/modules/auth/application/ports/clock';
import { AuthError } from '../../../src/modules/auth/domain/errors/auth-error';

const fakeHasher: PasswordHasher = {
  hash: async (password: string) => `hashed_${password}`,
  verify: async (pwd, hash) => hash === `hashed_${pwd}`
};

const fakeAccessTokenService: AccessTokenService = {
  generate: async ({ userId, sessionId }) => ({
    token: `jwt_${userId}_${sessionId}`,
    expiresAt: new Date('2026-01-01T00:15:00.000Z')
  }),
  verify: async (token: string) => {
    if (!token.startsWith('jwt_')) return null;
    const parts = token.split('_');
    const userId = parts[1];
    const sessionId = parts[2];
    if (!userId || !sessionId) return null;
    return { userId, sessionId };
  }
};

const fakeTokenGenerator: RefreshTokenGenerator = {
  generate: async () => ({
    token: 'opaque_refresh_token_123',
    hash: 'sha256_hash_123'
  }),
  hash: async (t: string) => `sha256_${t}`
};

const policy: TokenLifetimePolicy = {
  accessTokenTtlSeconds: 900,
  refreshTokenTtlSeconds: 2592000
};

const fixedClock: Clock = {
  now: () => new Date('2026-01-01T00:00:00.000Z')
};

describe('LoginUser use case', () => {
  test('login valid mengembalikan access token dan cookie token', async () => {
    const repo = new InMemoryAuthRepository();
    const register = new RegisterUser(repo, fakeHasher, fixedClock);
    await register.execute({
      email: 'dev@example.com',
      displayName: 'Dev',
      password: 'a-secure-long-passphrase'
    });

    const login = new LoginUser(
      repo,
      repo,
      fakeHasher,
      fakeAccessTokenService,
      fakeTokenGenerator,
      policy,
      fixedClock
    );

    const result = await login.execute({
      email: 'dev@example.com',
      password: 'a-secure-long-passphrase',
      userAgent: 'Mozilla/5.0'
    });

    expect(result.user.email).toBe('dev@example.com');
    expect(result.tokenType).toBe('Bearer');
    expect(result.expiresIn).toBe(900);
    expect(result.accessToken).toBeString();
    expect(result.refreshCookieToken).toBe('opaque_refresh_token_123');

    // Cek session tersimpan
    expect(repo.sessions.length).toBe(1);
    expect(repo.sessions[0]?.userId).toBe(result.user.id);
    expect(repo.sessions[0]?.userAgent).toBe('Mozilla/5.0');
    // Refresh token hash tersimpan di DB, bukan plaintext
    expect(repo.refreshTokens[0]?.tokenHash).toBe('sha256_hash_123');
  });

  test('password salah menghasilkan error INVALID_CREDENTIALS', async () => {
    const repo = new InMemoryAuthRepository();
    const register = new RegisterUser(repo, fakeHasher, fixedClock);
    await register.execute({
      email: 'dev@example.com',
      displayName: 'Dev',
      password: 'a-secure-long-passphrase'
    });

    const login = new LoginUser(
      repo,
      repo,
      fakeHasher,
      fakeAccessTokenService,
      fakeTokenGenerator,
      policy,
      fixedClock
    );

    await expect(
      login.execute({
        email: 'dev@example.com',
        password: 'wrong-password-here',
        userAgent: null
      })
    ).rejects.toThrow('Invalid email or password');
  });

  test('email tidak ditemukan menghasilkan error INVALID_CREDENTIALS yang persis sama', async () => {
    const repo = new InMemoryAuthRepository();
    const login = new LoginUser(
      repo,
      repo,
      fakeHasher,
      fakeAccessTokenService,
      fakeTokenGenerator,
      policy,
      fixedClock
    );

    let error: any;
    try {
      await login.execute({
        email: 'nonexistent@example.com',
        password: 'a-secure-long-passphrase',
        userAgent: null
      });
    } catch (e) {
      error = e;
    }

    expect(error).toBeInstanceOf(AuthError);
    expect(error.code).toBe('INVALID_CREDENTIALS');
    expect(error.message).toBe('Invalid email or password');
  });

  test('email login case-insensitive', async () => {
    const repo = new InMemoryAuthRepository();
    const register = new RegisterUser(repo, fakeHasher, fixedClock);
    await register.execute({
      email: 'dev@example.com',
      displayName: 'Dev',
      password: 'a-secure-long-passphrase'
    });

    const login = new LoginUser(
      repo,
      repo,
      fakeHasher,
      fakeAccessTokenService,
      fakeTokenGenerator,
      policy,
      fixedClock
    );

    const result = await login.execute({
      email: 'DEV@EXAMPLE.COM',
      password: 'a-secure-long-passphrase',
      userAgent: null
    });

    expect(result.user.email).toBe('dev@example.com');
  });
});
