export interface ApiErrorDetail {
  readonly path: string;
  readonly message: string;
}

export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
    readonly details?: readonly ApiErrorDetail[];
  };
}

export function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null || !('error' in value)) {
    return false;
  }

  const error = value.error;

  if (typeof error !== 'object' || error === null) {
    return false;
  }

  if (
    !('code' in error) ||
    !('message' in error) ||
    !('requestId' in error) ||
    typeof error.code !== 'string' ||
    typeof error.message !== 'string' ||
    typeof error.requestId !== 'string'
  ) {
    return false;
  }

  if ('details' in error && error.details !== undefined) {
    return (
      Array.isArray(error.details) &&
      error.details.every(
        (detail: unknown) =>
          typeof detail === 'object' &&
          detail !== null &&
          'path' in detail &&
          'message' in detail &&
          typeof detail.path === 'string' &&
          typeof detail.message === 'string'
      )
    );
  }

  return true;
}
