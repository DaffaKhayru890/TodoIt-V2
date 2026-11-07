import { describe, expect, test } from 'bun:test';
import { createApp } from '../../src/bootstrap/create-app';
import { buildTestAppConfig } from '../helpers/test-app-config';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { CheckServiceReadiness } from '../../src/modules/health/application/check-service-readiness';
import { connectedProbe } from '../helpers/test-app';
import { InMemoryAuthRepository } from '../helpers/in-memory-auth-repository';
import { BunPasswordHasher } from '../../src/modules/auth/infrastructure/security/bun-password-hasher';
import { JoseAccessTokenService } from '../../src/modules/auth/infrastructure/security/jose-access-token.service';
import { CryptoRefreshTokenGenerator } from '../../src/modules/auth/infrastructure/security/crypto-refresh-token.generator';
import { systemClock } from '../../src/modules/auth/application/ports/clock';
import { RegisterUser } from '../../src/modules/auth/application/use-cases/register-user';
import { LoginUser } from '../../src/modules/auth/application/use-cases/login-user';
import { RefreshSession } from '../../src/modules/auth/application/use-cases/refresh-session';
import { LogoutUser } from '../../src/modules/auth/application/use-cases/logout-user';
import { GetCurrentUser } from '../../src/modules/auth/application/use-cases/get-current-user';

function createAuthTestApp() {
  const config = buildTestAppConfig();
  const logger = createLogger('silent');
  const readiness = new CheckServiceReadiness(connectedProbe);

  const authRepo = new InMemoryAuthRepository();
  const passwordHasher = new BunPasswordHasher();
  const accessTokenService = new JoseAccessTokenService({
    secret: config.auth.jwtSecret,
    issuer: config.auth.jwtIssuer,
    audience: config.auth.jwtAudience,
    ttlSeconds: config.auth.accessTokenTtlSeconds,
    clock: systemClock
  });
  const refreshTokenGenerator = new CryptoRefreshTokenGenerator();
  const tokenLifetimePolicy = {
    accessTokenTtlSeconds: config.auth.accessTokenTtlSeconds,
    refreshTokenTtlSeconds: config.auth.refreshTokenTtlSeconds
  };
  const securityLog = { warn: () => {} };

  const registerUser = new RegisterUser(authRepo, passwordHasher, systemClock);
  const loginUser = new LoginUser(
    authRepo,
    authRepo,
    passwordHasher,
    accessTokenService,
    refreshTokenGenerator,
    tokenLifetimePolicy,
    systemClock
  );
  const refreshSession = new RefreshSession(
    authRepo,
    accessTokenService,
    refreshTokenGenerator,
    tokenLifetimePolicy,
    systemClock,
    securityLog
  );
  const logoutUser = new LogoutUser(authRepo, refreshTokenGenerator, systemClock);
  const getCurrentUser = new GetCurrentUser(authRepo, authRepo, accessTokenService, systemClock);

  const app = createApp({
    config,
    logger,
    readiness,
    auth: {
      config,
      registerUser,
      loginUser,
      refreshSession,
      logoutUser,
      getCurrentUser
    }
  });

  return { app, config };
}

describe('Authentication Endpoints HTTP Integration', () => {
  test('alur lengkap: register -> login -> me -> refresh -> me -> logout -> me ditolak', async () => {
    const { app, config } = createAuthTestApp();

    // 1. Register
    const regRes = await app.handle(
      new Request('http://test.local/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          displayName: 'Test User',
          password: 'super-secret-password-123'
        })
      })
    );

    expect(regRes.status).toBe(201);
    const regBody = (await regRes.json()) as any;
    expect(regBody.user.email).toBe('user@example.com');
    expect(regBody.user.id).toBeString();

    // 2. Login
    const loginRes = await app.handle(
      new Request('http://test.local/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'super-secret-password-123'
        })
      })
    );

    expect(loginRes.status).toBe(200);
    const loginBody = (await loginRes.json()) as any;
    expect(loginBody.accessToken).toBeString();
    expect(loginBody.tokenType).toBe('Bearer');
    expect(loginBody.expiresIn).toBe(900);

    // Periksa cookie
    const cookieHeader = loginRes.headers.get('set-cookie');
    expect(cookieHeader).toBeString();
    expect(cookieHeader).toInclude(config.auth.refreshCookie.name);
    expect(cookieHeader?.toLowerCase()).toInclude('httponly');

    const cookieMatch = cookieHeader?.match(new RegExp(`${config.auth.refreshCookie.name}=([^;]+)`));
    const refreshTokenValue = cookieMatch?.[1] ?? '';
    expect(refreshTokenValue.length).toBeGreaterThan(0);

    const accessToken = loginBody.accessToken;

    // 3. Get Current User /me dengan Bearer token
    const meRes1 = await app.handle(
      new Request('http://test.local/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${accessToken}` }
      })
    );

    expect(meRes1.status).toBe(200);
    const meBody1 = (await meRes1.json()) as any;
    expect(meBody1.user.email).toBe('user@example.com');

    // 4. Refresh token
    const refreshRes = await app.handle(
      new Request('http://test.local/api/v1/auth/refresh', {
        method: 'POST',
        headers: {
          Cookie: `${config.auth.refreshCookie.name}=${refreshTokenValue}`
        }
      })
    );

    expect(refreshRes.status).toBe(200);
    const refreshBody = (await refreshRes.json()) as any;
    expect(refreshBody.accessToken).toBeString();
    const newAccessToken = refreshBody.accessToken;

    const refreshCookieHeader = refreshRes.headers.get('set-cookie');
    expect(refreshCookieHeader).toBeString();
    const refreshCookieMatch = refreshCookieHeader?.match(new RegExp(`${config.auth.refreshCookie.name}=([^;]+)`));
    const newRefreshTokenValue = refreshCookieMatch ? refreshCookieMatch[1] : '';

    // 5. Get Current User dengan new access token
    const meRes2 = await app.handle(
      new Request('http://test.local/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${newAccessToken}` }
      })
    );
    expect(meRes2.status).toBe(200);

    // 6. Logout
    const logoutRes = await app.handle(
      new Request('http://test.local/api/v1/auth/logout', {
        method: 'POST',
        headers: {
          Cookie: `${config.auth.refreshCookie.name}=${newRefreshTokenValue}`
        }
      })
    );
    expect(logoutRes.status).toBe(204);

    // 7. Get Current User setelah logout harus ditolak karena session di-revoke (401)
    const meRes3 = await app.handle(
      new Request('http://test.local/api/v1/auth/me', {
        headers: { Authorization: `Bearer ${newAccessToken}` }
      })
    );
    expect(meRes3.status).toBe(401);
  });

  test('validasi body registrasi: email salah atau password pendek -> 422', async () => {
    const { app } = createAuthTestApp();

    const res = await app.handle(
      new Request('http://test.local/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'bukan-email',
          displayName: 'User',
          password: 'short'
        })
      })
    );

    expect(res.status).toBe(422);
    const body = (await res.json()) as any;
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  test('registrasi email duplikat -> 409 EMAIL_ALREADY_EXISTS', async () => {
    const { app } = createAuthTestApp();

    await app.handle(
      new Request('http://test.local/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'dup@example.com',
          displayName: 'User 1',
          password: 'super-secret-password-123'
        })
      })
    );

    const dupRes = await app.handle(
      new Request('http://test.local/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'dup@example.com',
          displayName: 'User 2',
          password: 'super-secret-password-123'
        })
      })
    );

    expect(dupRes.status).toBe(409);
    const body = (await dupRes.json()) as any;
    expect(body.error.code).toBe('EMAIL_ALREADY_EXISTS');
  });

  test('login password salah -> 401 INVALID_CREDENTIALS', async () => {
    const { app } = createAuthTestApp();

    await app.handle(
      new Request('http://test.local/api/v1/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          displayName: 'User',
          password: 'super-secret-password-123'
        })
      })
    );

    const loginRes = await app.handle(
      new Request('http://test.local/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'wrong-password'
        })
      })
    );

    expect(loginRes.status).toBe(401);
    const body = (await loginRes.json()) as any;
    expect(body.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('akses /me tanpa header Authorization -> 401 UNAUTHORIZED', async () => {
    const { app } = createAuthTestApp();

    const res = await app.handle(new Request('http://test.local/api/v1/auth/me'));
    expect(res.status).toBe(401);
  });
});
