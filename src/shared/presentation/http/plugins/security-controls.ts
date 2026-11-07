import { Elysia } from 'elysia';
import type { AppConfig } from '../../../../config/app-config';
import type { RateLimiter } from '../../../application/rate-limiter';
import type { Metrics } from '../../../infrastructure/observability/metrics';
import { ERROR_CODES, buildErrorPayload } from '../errors/error-response';
import { REQUEST_ID_HEADER, ensureRequestId, requestPathOf } from '../middleware/request-context';

const COOKIE_MUTATION_PATHS = new Set(['/api/v1/auth/refresh', '/api/v1/auth/logout']);

type HeaderSetter = {
  status?: number | string;
  headers: Record<string, string | number>;
};

export function clientAddress(request: Request, trustedHops: number): string {
  if (trustedHops <= 0) {
    return 'direct';
  }

  const forwarded = request.headers.get('x-forwarded-for');

  if (!forwarded) {
    return 'unknown';
  }

  const parts = forwarded
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const index = parts.length - trustedHops;

  return parts[index] ?? 'unknown';
}

function subjectKey(request: Request): string {
  const authorization = request.headers.get('authorization');

  if (!authorization) {
    return 'anon';
  }

  return new Bun.CryptoHasher('sha256').update(authorization).digest('hex').slice(0, 16);
}

function limitFor(config: AppConfig, method: string, path: string): { category: string; limit: number } | null {
  if (path.startsWith('/api/v1/auth/')) {
    return { category: 'auth', limit: config.security.rateLimit.authPerMinute };
  }

  if (path.includes('/invitations')) {
    return { category: 'invitation', limit: config.security.rateLimit.invitationPerMinute };
  }

  if (path.includes('/todos') && method !== 'GET' && method !== 'HEAD') {
    return { category: 'todo_write', limit: config.security.rateLimit.todoWritePerMinute };
  }

  if (path.startsWith('/api/v1/notifications')) {
    return { category: 'notification', limit: config.security.rateLimit.notificationPerMinute };
  }

  return null;
}

export function applySecurityHeaders(config: AppConfig, path: string, set: HeaderSetter): void {
  set.headers['x-content-type-options'] = 'nosniff';
  set.headers['referrer-policy'] = 'no-referrer';
  set.headers['x-frame-options'] = 'DENY';

  if (path.startsWith('/openapi')) {
    set.headers['content-security-policy'] =
      "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'";
  }

  if (config.security.hsts) {
    set.headers['strict-transport-security'] = 'max-age=15552000; includeSubDomains';
  }
}

export async function enforceHttpSecurity(
  config: AppConfig,
  rateLimiter: RateLimiter | null,
  metrics: Metrics,
  request: Request,
  set: HeaderSetter
): Promise<ReturnType<typeof buildErrorPayload> | undefined> {
  const path = requestPathOf(request);
  applySecurityHeaders(config, path, set);
  const requestId = ensureRequestId(set, request.headers.get(REQUEST_ID_HEADER));
  const lengthHeader = request.headers.get('content-length');

  if (lengthHeader) {
    const length = Number(lengthHeader);

    if (Number.isFinite(length) && length > config.security.requestBodyLimitBytes) {
      metrics.increment('http.payload_too_large');
      set.status = 413;
      return buildErrorPayload(ERROR_CODES.PAYLOAD_TOO_LARGE, 'Ukuran body melebihi batas yang diizinkan.', requestId);
    }
  }

  if (COOKIE_MUTATION_PATHS.has(path)) {
    const origin = request.headers.get('origin');

    if (origin && !config.corsOrigins.includes(origin)) {
      metrics.increment('http.origin_rejected');
      set.status = 403;
      return buildErrorPayload(ERROR_CODES.ORIGIN_REJECTED, 'Origin tidak diizinkan untuk permintaan cookie ini.', requestId);
    }
  }

  if (!config.security.rateLimit.enabled || !rateLimiter) {
    return undefined;
  }

  const category = limitFor(config, request.method, path);

  if (!category) {
    return undefined;
  }

  const decision = await rateLimiter.consume({
    key: `${category.category}:${clientAddress(request, config.security.trustedProxyHops)}:${subjectKey(request)}`,
    limit: category.limit,
    windowSeconds: 60
  });

  if (decision.allowed) {
    return undefined;
  }

  metrics.increment('http.rate_limited');
  set.status = 429;
  set.headers['retry-after'] = String(decision.retryAfterSeconds);
  return buildErrorPayload(ERROR_CODES.RATE_LIMITED, 'Terlalu banyak permintaan. Coba lagi setelah jendela waktu berakhir.', requestId);
}

export function createSecurityPlugin(config: AppConfig, metrics: Metrics) {
  return new Elysia({ name: 'security-controls' })
    .onAfterHandle(({ request, set }) => {
      applySecurityHeaders(config, requestPathOf(request), set);
      const status = typeof set.status === 'number' ? set.status : 200;
      metrics.increment('http.requests');
      metrics.increment(`http.status.${status}`);
    });
}
