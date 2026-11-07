import { sql } from 'drizzle-orm';
import type { RateLimiter, RateLimitDecision } from '../../application/rate-limiter';
import type { DatabaseExecutor } from '../database/client';

export class PostgresRateLimiter implements RateLimiter {
  constructor(private readonly database: DatabaseExecutor) {}

  async consume(input: { key: string; limit: number; windowSeconds: number }): Promise<RateLimitDecision> {
    const rows = await this.database.execute(sql`
      INSERT INTO rate_limit_windows (bucket_key, window_started_at, request_count, updated_at)
      VALUES (${input.key}, now(), 1, now())
      ON CONFLICT (bucket_key) DO UPDATE
      SET
        request_count = CASE
          WHEN rate_limit_windows.window_started_at <= now() - make_interval(secs => ${input.windowSeconds}) THEN 1
          ELSE rate_limit_windows.request_count + 1
        END,
        window_started_at = CASE
          WHEN rate_limit_windows.window_started_at <= now() - make_interval(secs => ${input.windowSeconds}) THEN now()
          ELSE rate_limit_windows.window_started_at
        END,
        updated_at = now()
      RETURNING request_count
    `);
    const count = Number(rows.rows[0]?.request_count ?? rows.rows[0]?.requestCount ?? 1);
    const allowed = count <= input.limit;

    return {
      allowed,
      limit: input.limit,
      remaining: Math.max(0, input.limit - count),
      retryAfterSeconds: input.windowSeconds
    };
  }
}
