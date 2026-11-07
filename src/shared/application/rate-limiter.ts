export interface RateLimitDecision {
  readonly allowed: boolean;
  readonly limit: number;
  readonly remaining: number;
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(input: { key: string; limit: number; windowSeconds: number }): Promise<RateLimitDecision>;
}

export class MemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, { start: number; count: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async consume(input: { key: string; limit: number; windowSeconds: number }): Promise<RateLimitDecision> {
    const windowMs = input.windowSeconds * 1000;
    const now = this.now();
    const current = this.buckets.get(input.key);

    if (!current || now - current.start >= windowMs) {
      this.buckets.set(input.key, { start: now, count: 1 });
      return { allowed: true, limit: input.limit, remaining: Math.max(0, input.limit - 1), retryAfterSeconds: input.windowSeconds };
    }

    current.count += 1;
    const allowed = current.count <= input.limit;

    return {
      allowed,
      limit: input.limit,
      remaining: Math.max(0, input.limit - current.count),
      retryAfterSeconds: Math.max(1, Math.ceil((current.start + windowMs - now) / 1000))
    };
  }
}
