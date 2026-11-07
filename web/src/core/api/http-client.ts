import { isApiErrorBody } from '@/core/api/api-response';
import { ApiError } from '@/core/errors/api-error';

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface HttpRequest {
  readonly method?: HttpMethod;
  readonly body?: unknown;
  readonly headers?: Readonly<Record<string, string>>;
  readonly signal?: AbortSignal;
}

export interface HttpClientOptions {
  readonly baseUrl: string;
  readonly fetchFn?: typeof fetch;
  /** Titik integrasi access token. Login belum diimplementasikan pada phase ini. */
  readonly getAccessToken?: () => string | null;
}

export interface HttpClient {
  request<T>(path: string, request?: HttpRequest): Promise<T>;
}

export function createHttpClient(options: HttpClientOptions): HttpClient {
  const baseUrl = options.baseUrl.replace(/\/$/, '');
  const fetchFn = options.fetchFn ?? fetch;

  return {
    async request<T>(path: string, request: HttpRequest = {}): Promise<T> {
      const headers = new Headers(request.headers);
      headers.set('accept', 'application/json');

      if (request.body !== undefined) {
        headers.set('content-type', 'application/json');
      }

      const token = options.getAccessToken?.() ?? null;

      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }

      let response: Response;

      try {
        response = await fetchFn(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`, {
          method: request.method ?? 'GET',
          headers,
          credentials: 'include',
          ...(request.body !== undefined ? { body: JSON.stringify(request.body) } : {}),
          ...(request.signal ? { signal: request.signal } : {})
        });
      } catch {
        throw new ApiError('Tidak dapat menghubungi server.', 0, 'NETWORK_ERROR');
      }

      if (response.status === 204) {
        return undefined as T;
      }

      const payload = await readJson(response);

      if (!response.ok) {
        if (isApiErrorBody(payload)) {
          throw new ApiError(payload.error.message, response.status, payload.error.code);
        }

        throw new ApiError('Permintaan ditolak server.', response.status);
      }

      return payload as T;
    }
  };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new ApiError('Respons server bukan JSON yang valid.', response.status, 'INVALID_JSON');
  }
}
