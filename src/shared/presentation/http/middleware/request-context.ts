import type { Elysia } from 'elysia';
import type { Logger } from '../../../infrastructure/logging/logger';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Panjang maksimum nilai x-request-id yang boleh disalin dari klien. */
const MAX_REQUEST_ID_LENGTH = 128;
const SAFE_REQUEST_ID_PATTERN = /^[A-Za-z0-9._~:+-]+$/;

interface HeadersCarrier {
  headers: Record<string, unknown>;
}

function sanitizeIncomingRequestId(incoming: string | null | undefined): string | undefined {
  // Header dari klien dipakai agar permintaan tertrace lintas layanan, tetapi
  // nilainya tidak pernah disalin apa adanya sebelum dibersihkan.
  if (
    incoming === null ||
    incoming === undefined ||
    incoming.length === 0 ||
    incoming.length > MAX_REQUEST_ID_LENGTH ||
    !SAFE_REQUEST_ID_PATTERN.test(incoming)
  ) {
    return undefined;
  }

  return incoming;
}

/**
 * Mengembalikan requestId permintaan berjalan. Nilainya dibuat sekali lalu
 * disimpan pada `set.headers` sehingga hook dan handler dalam request yang sama
 * membaca ID yang identik tanpa memakai state global.
 */
export function ensureRequestId(carrier: HeadersCarrier, incoming: string | null | undefined): string {
  const assigned = carrier.headers[REQUEST_ID_HEADER];

  if (typeof assigned === 'string') {
    return assigned;
  }

  const requestId = sanitizeIncomingRequestId(incoming) ?? crypto.randomUUID();

  carrier.headers[REQUEST_ID_HEADER] = requestId;

  return requestId;
}

export function requestPathOf(request: Request): string {
  return new URL(request.url).pathname;
}

type AnyElysia = Elysia<any, any, any, any, any, any, any>;

/**
 * Memasang identitas permintaan dan access log terstruktur.
 *
 * Hook sengaja dipasang langsung pada instance root, bukan lewat plugin terpisah:
 * lifecycle yang didefinisikan root diwarisi seluruh route termasuk route modul
 * yang di-mount kemudian, sedangkan lifecycle plugin lokal hanya melayani route
 * miliknya sendiri.
 */
export function withRequestContext<T extends AnyElysia>(app: T, logger: Logger) {
  return app
    .onRequest(({ request, set }) => {
      ensureRequestId(set, request.headers.get(REQUEST_ID_HEADER));
    })
    .onAfterHandle(({ request, set }) => {
      const requestId = ensureRequestId(set, request.headers.get(REQUEST_ID_HEADER));

      logger
        .child({ requestId, component: 'http', method: request.method, path: requestPathOf(request) })
        .info('request handled', { status: Number(set.status ?? 200) });
    });
}
