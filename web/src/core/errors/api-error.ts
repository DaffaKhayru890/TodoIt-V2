import type { ApiErrorDetail } from '@/core/api/api-response';

export class ApiError extends Error {
  readonly status: number;
  readonly code: string | undefined;
  readonly details: readonly ApiErrorDetail[];

  constructor(
    message: string,
    status: number,
    code?: string,
    details: readonly ApiErrorDetail[] = []
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
