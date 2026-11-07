import { describe, expect, test } from 'bun:test';
import { loadAppConfig } from '../../src/config/app-config';
import { createDatabaseClient } from '../../src/shared/infrastructure/database/client';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { DrizzleAuthRepository } from '../../src/modules/auth/infrastructure/persistence/drizzle-auth.repository';
import { toEmail } from '../../src/modules/auth/domain/value-objects/email';
import { AuthError } from '../../src/modules/auth/domain/errors/auth-error';

const config = loadAppConfig();
const silentLogger = createLogger('silent');

describe('DrizzleAuthRepository terhadap PostgreSQL nyata', () => {
  test('registrasi user dan constraint unique email', async () => {
    const client = createDatabaseClient(config.database, silentLogger);
    const repo = new DrizzleAuthRepository(client);

    const emailStr = `test_pg_${Date.now()}@example.com`;
    const now = new Date();

    try {
      const user = await repo.createNewUser({
        email: toEmail(emailStr),
        displayName: 'Postgres User',
        passwordHash: 'dummy_hash',
        now
      });

      expect(user.id).toBeString();
      expect(user.email.value).toBe(emailStr);

      // Duplikat email harus memetakan ke AuthError EMAIL_ALREADY_EXISTS
      await expect(
        repo.createNewUser({
          email: toEmail(emailStr),
          displayName: 'Second User',
          passwordHash: 'dummy_hash_2',
          now
        })
      ).rejects.toThrow(AuthError);
    } finally {
      await client.close();
    }
  });

  test('rotasi refresh token di dalam transaksi database nyata', async () => {
    const client = createDatabaseClient(config.database, silentLogger);
    const repo = new DrizzleAuthRepository(client);

    const emailStr = `test_rot_${Date.now()}@example.com`;
    const now = new Date();
    const future = new Date(now.getTime() + 1000000);

    try {
      const user = await repo.createNewUser({
        email: toEmail(emailStr),
        displayName: 'Rotate User',
        passwordHash: 'hash',
        now
      });

      const { refreshToken } = await repo.startSession({
        userId: user.id,
        hash: `initial_hash_${Date.now()}`,
        sessionExpiresAt: future,
        tokenExpiresAt: future,
        userAgent: 'Test Agent',
        now
      });

      // Rotasi token
      const outcome = await repo.rotateRefreshToken({
        presentedHash: refreshToken.tokenHash,
        replacementHash: `new_hash_${Date.now()}`,
        tokenExpiresAt: future,
        now: new Date()
      });

      expect(outcome.status).toBe('rotated');
      if (outcome.status === 'rotated') {
        expect(outcome.previousTokenId).toBe(refreshToken.id);
        expect(outcome.replacement.tokenHash).toStartWith('new_hash_');
      }

      // Memakai token lama kembali memicu reuse detection
      const reuseOutcome = await repo.rotateRefreshToken({
        presentedHash: refreshToken.tokenHash,
        replacementHash: `attacker_hash_${Date.now()}`,
        tokenExpiresAt: future,
        now: new Date()
      });

      expect(reuseOutcome.status).toBe('reused');
      if (reuseOutcome.status === 'reused') {
        expect(reuseOutcome.userId).toBe(user.id);
        expect(reuseOutcome.revokedSessionCount).toBeGreaterThan(0);
      }
    } finally {
      await client.close();
    }
  });

  test('concurrency: dua rotasi simultan menggunakan token yang sama di PostgreSQL', async () => {
    const client = createDatabaseClient(config.database, silentLogger);
    const repo = new DrizzleAuthRepository(client);

    const emailStr = `test_conc_${Date.now()}@example.com`;
    const now = new Date();
    const future = new Date(now.getTime() + 1000000);

    try {
      const user = await repo.createNewUser({
        email: toEmail(emailStr),
        displayName: 'Concurrent User',
        passwordHash: 'hash',
        now
      });

      const tokenHash = `conc_token_${Date.now()}`;
      await repo.startSession({
        userId: user.id,
        hash: tokenHash,
        sessionExpiresAt: future,
        tokenExpiresAt: future,
        userAgent: null,
        now
      });

      // Jalankan dua request rotasi bersamaan menggunakan token yang sama
      const [res1, res2] = await Promise.all([
        repo.rotateRefreshToken({
          presentedHash: tokenHash,
          replacementHash: `rep1_${Date.now()}`,
          tokenExpiresAt: future,
          now: new Date()
        }),
        repo.rotateRefreshToken({
          presentedHash: tokenHash,
          replacementHash: `rep2_${Date.now()}`,
          tokenExpiresAt: future,
          now: new Date()
        })
      ]);

      const statuses = [res1.status, res2.status];
      // Tepat satu yang berhasil ('rotated'), dan yang lain mendeteksi reuse ('reused')
      expect(statuses).toContain('rotated');
      expect(statuses).toContain('reused');
    } finally {
      await client.close();
    }
  });
});
