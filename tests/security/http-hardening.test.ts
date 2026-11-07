import { describe, expect, test } from 'bun:test';
import { createApp } from '../../src/bootstrap/create-app';
import { CheckServiceReadiness } from '../../src/modules/health/application/check-service-readiness';
import { MemoryRateLimiter } from '../../src/shared/application/rate-limiter';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { clientAddress } from '../../src/shared/presentation/http/plugins/security-controls';
import { buildTestAppConfig } from '../helpers/test-app-config';

function appWith(limiter: MemoryRateLimiter | null, overrides = {}) {
  return createApp({
    config: buildTestAppConfig(overrides),
    logger: createLogger('silent'),
    readiness: new CheckServiceReadiness({ probe: () => Promise.resolve() }),
    rateLimiter: limiter
  });
}

describe('http hardening', () => {
  test('menolak origin cookie yang tidak ada di allowlist', async () => {
    const response = await appWith(null).handle(
      new Request('http://test.local/api/v1/auth/refresh', {
        method: 'POST',
        headers: { origin: 'https://evil.example' }
      })
    );

    expect(response.status).toBe(403);
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    const body = JSON.stringify(await response.json());
    expect(body).not.toContain('stack');
    expect(body).toContain('ORIGIN_REJECTED');
  });

  test('membatasi body dan auth request', async () => {
    const limiter = new MemoryRateLimiter();
    const config = buildTestAppConfig({
      security: {
        ...buildTestAppConfig().security,
        requestBodyLimitBytes: 32,
        rateLimit: { ...buildTestAppConfig().security.rateLimit, authPerMinute: 1 }
      }
    });
    const app = createApp({
      config,
      logger: createLogger('silent'),
      readiness: new CheckServiceReadiness({ probe: () => Promise.resolve() }),
      rateLimiter: limiter
    });
    const large = await app.handle(
      new Request('http://test.local/api/v1/auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'content-length': '1000' },
        body: JSON.stringify({ email: 'a@b.co', password: 'x' })
      })
    );
    expect(large.status).toBe(413);

    const first = await app.handle(new Request('http://test.local/api/v1/auth/login', { method: 'POST' }));
    const second = await app.handle(new Request('http://test.local/api/v1/auth/login', { method: 'POST' }));
    expect(first.status).not.toBe(429);
    expect(second.status).toBe(429);
  });

  test('mengabaikan X-Forwarded-For bila proxy tidak dipercaya', () => {
    const request = new Request('http://test.local/health', { headers: { 'x-forwarded-for': '1.2.3.4' } });
    expect(clientAddress(request, 0)).toBe('direct');
    expect(clientAddress(request, 1)).toBe('1.2.3.4');
  });

  test('log meredaksi authorization dan password', () => {
    const lines: string[] = [];
    const logger = createLogger('info', (line) => {
      lines.push(line);
    });
    logger.info('login', { authorization: 'Bearer abc.def.ghi', password: 'secret-value', path: '/login' });
    const text = lines.join('\n');
    expect(text).toContain('[redacted]');
    expect(text).not.toContain('abc.def.ghi');
    expect(text).not.toContain('secret-value');
  });
});
