export interface RetryJitterSource {
  /** Nilai 0 sampai 1. */
  next(): number;
}

export interface RetryDecision {
  readonly retry: boolean;
  readonly delaySeconds: number;
}

/**
 * Backoff eksponensial dengan jitter ±20%. Attempt dihitung setelah claim,
 * jadi kegagalan pertama memakai base * 2^0.
 */
export function decideRetry(input: {
  attempts: number;
  maxAttempts: number;
  baseRetrySeconds: number;
  maxRetrySeconds: number;
  permanent: boolean;
  jitter: RetryJitterSource;
}): RetryDecision {
  if (input.permanent || input.attempts >= input.maxAttempts) {
    return { retry: false, delaySeconds: 0 };
  }

  const exponent = Math.max(0, input.attempts - 1);
  const raw = Math.min(input.maxRetrySeconds, input.baseRetrySeconds * 2 ** exponent);
  const factor = 0.8 + input.jitter.next() * 0.4;

  return { retry: true, delaySeconds: Math.max(1, Math.round(raw * factor)) };
}
