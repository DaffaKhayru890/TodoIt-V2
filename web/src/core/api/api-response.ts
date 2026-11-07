export interface ApiErrorBody {
  readonly error: {
    readonly code: string;
    readonly message: string;
    readonly requestId: string;
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

  return (
    'code' in error &&
    'message' in error &&
    'requestId' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.requestId === 'string'
  );
}
