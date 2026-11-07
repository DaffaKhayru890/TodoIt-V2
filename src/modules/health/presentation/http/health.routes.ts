import { Elysia, status, t } from 'elysia';
import { ERROR_CODES, buildErrorPayload, errorResponseSchema } from '../../../../shared/presentation/http/errors/error-response';
import {
  REQUEST_ID_HEADER,
  ensureRequestId
} from '../../../../shared/presentation/http/middleware/request-context';
import type { CheckServiceReadiness } from '../../application/check-service-readiness';

const healthResponseSchema = t.Object(
  {
    status: t.Literal('ok', { description: 'Penanda bahwa HTTP server berjalan.' })
  },
  {
    title: 'HealthResponse',
    description: 'Respons liveness sederhana tanpa pemeriksaan dependensi.',
    examples: [{ ok: { status: 'ok' } }]
  }
);

const readyResponseSchema = t.Object(
  {
    status: t.Literal('ready', { description: 'Aplikasi siap menerima request.' }),
    dependencies: t.Object(
      {
        database: t.Literal('connected', { description: 'Status koneksi PostgreSQL.' })
      },
      { description: 'Status dependensi inti yang periksa saat ini.' }
    )
  },
  {
    title: 'ReadyResponse',
    description: 'Respons readiness. Hanya status agregat yang diekspos, tanpa host, port, user, atau nama database.',
    examples: [{ ready: { status: 'ready', dependencies: { database: 'connected' } } }]
  }
);

/**
 * Presentation layer modul health. Tidak ada business logic di sini: use case
 * `CheckServiceReadiness` yang menentukan kesiapan layanan, route ini hanya
 * menerjemahkan hasilnya ke HTTP.
 */
export function createHealthRoutes(deps: { readiness: CheckServiceReadiness }) {
  return new Elysia()
    .get(
      '/health',
      () => ({ status: 'ok' as const }),
      {
        response: { 200: healthResponseSchema },
        detail: {
          summary: 'Liveness probe',
          description: [
            'Menunjukkan bahwa proses HTTP server hidup dan dapat merespons request.',
            'Method: GET. URL: `/health`. Tidak ada path parameter, query parameter, maupun request body.',
            'Endpoint ini sengaja tidak menyentuh database supaya tetap menjawab saat database bermasalah.',
            'Error yang mungkin muncul: tidak ada, karena handler tidak bergantung pada resource eksternal.'
          ].join(' '),
          tags: ['Health'],
          responses: {
            200: {
              description: 'Server hidup. Contoh body: `{ "status": "ok" }`.'
            }
          }
        }
      }
    )
    .get(
      '/ready',
      async ({ headers, set }) => {
        const readiness = await deps.readiness.execute();

        if (readiness.status === 'ready') {
          return { status: 'ready' as const, dependencies: { database: 'connected' as const } };
        }

        return status(
          503,
          buildErrorPayload(
            ERROR_CODES.SERVICE_UNAVAILABLE,
            'Salah satu dependensi inti belum siap menerima request.',
            ensureRequestId(set, headers[REQUEST_ID_HEADER])
          )
        );
      },
      {
        response: { 200: readyResponseSchema, 503: errorResponseSchema },
        detail: {
          summary: 'Readiness probe',
          description: [
            'Memastikan aplikasi siap menerima request dengan memeriksa koneksi database memakai `SELECT 1`.',
            'Method: GET. URL: `/ready`. Tidak ada path parameter, query parameter, maupun request body.',
            'Bila database dapat dihubungi, mengembalikan 200 `{ "status": "ready", "dependencies": { "database": "connected" } }`.',
            'Bila database tidak dapat dihubungi atau pemeriksaan melebihi batas waktu, mengembalikan 503 dengan sampul error standar berisi kode `SERVICE_UNAVAILABLE` dan `requestId`.',
            'Detail koneksi (host, port, user, password, nama database) tidak pernah diekspos ke klien.'
          ].join(' '),
          tags: ['Health'],
          responses: {
            200: {
              description: 'Contoh body: `{ "status": "ready", "dependencies": { "database": "connected" } }`.'
            },
            503: {
              description:
                'Contoh body: `{ "error": { "code": "SERVICE_UNAVAILABLE", "message": "Salah satu dependensi inti belum siap menerima request.", "requestId": "..." } }`.'
            }
          }
        }
      }
    );
}
