import { ApiError } from '@/core/errors/api-error';

/**
 * Tidak mengulang request untuk error yang tidak akan berubah bila diulang.
 * Error jaringan/5xx tetap dicoba sekali oleh konfigurasi QueryClient.
 */
export function shouldRetryTodoQuery(failureCount: number, error: Error): boolean {
  if (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403 || error.status === 404)
  ) {
    return false;
  }

  return failureCount < 1;
}
