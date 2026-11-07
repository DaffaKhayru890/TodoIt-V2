import type { AppConfig } from '../../src/config/app-config';

/** Secret test: panjangnya memenuhi aturan minimal 32 karakter, bukan nilai nyata. */
export const TEST_JWT_SECRET = '0123456789abcdef0123456789abcdef0123456789abcdef';

/**
 * Konfigurasi eksplisit untuk test. Sengaja tidak membaca process.env supaya
 * unit test tetap deterministik dan tidak bergantung pada file environment.
 */
export function buildTestAppConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    environment: 'test',
    isProduction: false,
    appName: 'Todo Backend Test',
    appVersion: '0.0.0-test',
    port: 4001,
    host: '127.0.0.1',
    logLevel: 'silent',
    defaultTimezone: 'UTC',
    corsOrigins: ['http://localhost:3000'],
    database: {
      host: 'db.internal.test',
      port: 5432,
      user: 'svc_todo',
      password: 'rahasia-test',
      name: 'todo_test',
      ssl: false,
      poolMax: 5,
      idleTimeoutMs: 30_000,
      connectionTimeoutMs: 5_000,
      statementTimeoutMs: 15_000
    },
    auth: {
      jwtSecret: TEST_JWT_SECRET,
      jwtPreviousSecrets: [],
      jwtIssuer: 'todo-backend',
      jwtAudience: 'todo-api',
      accessTokenTtlSeconds: 900,
      refreshTokenTtlSeconds: 2_592_000,
      refreshCookie: { name: 'todo_refresh', secure: false, sameSite: 'lax' }
    },
    smtp: {
      host: 'localhost',
      port: 1025,
      user: '',
      password: '',
      from: 'Todo Backend <noreply@localhost>',
      secure: false,
      connectionTimeoutMs: 10_000
    },
    webAppUrl: 'http://localhost:3000',
    invitationTokenTtlSeconds: 604_800,
    notification: {
      workerEnabled: true,
      pollIntervalMs: 5000,
      concurrency: 5,
      leaseSeconds: 60,
      maxAttempts: 8,
      baseRetrySeconds: 5,
      maxRetrySeconds: 3600,
      schedulerIntervalSeconds: 60,
      lookaheadDays: 90,
      dueSoonOffsetMinutes: [60, 1440],
      completedRetentionDays: 14,
      failedRetentionDays: 90
    },
    security: {
      trustedProxyHops: 0,
      requestBodyLimitBytes: 1_048_576,
      requestTimeoutMs: 30_000,
      shutdownGraceMs: 15_000,
      hsts: false,
      auditRetentionDays: 365,
      rateLimit: {
        enabled: true,
        authPerMinute: 20,
        invitationPerMinute: 30,
        todoWritePerMinute: 120,
        notificationPerMinute: 240
      }
    },
    ...overrides
  };
}
