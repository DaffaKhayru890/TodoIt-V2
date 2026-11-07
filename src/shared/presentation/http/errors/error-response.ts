import { t, type Static } from 'elysia';

/**
 * Kode error stabil yang menjadi kontrak API. Klien boleh bergantung pada nilai
 * ini, jadi tambahkan nilai baru alih-alih mengubah makna nilai yang ada.
 */
export const ERROR_CODES = {
  BAD_REQUEST: 'BAD_REQUEST',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  EMAIL_ALREADY_EXISTS: 'EMAIL_ALREADY_EXISTS',
  INVALID_EMAIL: 'INVALID_EMAIL',
  INVALID_PASSWORD: 'INVALID_PASSWORD',
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_ACCESS_TOKEN: 'INVALID_ACCESS_TOKEN',
  INVALID_REFRESH_TOKEN: 'INVALID_REFRESH_TOKEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_REVOKED: 'SESSION_REVOKED',
  USER_NOT_FOUND: 'USER_NOT_FOUND',
  WORKSPACE_NOT_FOUND: 'WORKSPACE_NOT_FOUND',
  WORKSPACE_ACCESS_DENIED: 'WORKSPACE_ACCESS_DENIED',
  WORKSPACE_PERMISSION_DENIED: 'WORKSPACE_PERMISSION_DENIED',
  WORKSPACE_NAME_INVALID: 'WORKSPACE_NAME_INVALID'
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Skema TypeBox: sumber kebenaran untuk dokumentasi OpenAPI sekaligus bentuk body error. */
export const errorDetailSchema = t.Object({
  path: t.String({ description: 'Lokasi field yang bermasalah, misalnya body.title.' }),
  message: t.String({ description: 'Penjelasan singkat kenapa field tersebut ditolak.' })
});

export const errorResponseSchema = t.Object(
  {
    error: t.Object({
      code: t.String({
        description: 'Kode error stabil untuk diproses klien.',
        enum: Object.values(ERROR_CODES)
      }),
      message: t.String({ description: 'Pesan aman untuk ditampilkan; tidak memuat detail internal.' }),
      requestId: t.String({ description: 'ID permintaan yang sama dengan header x-request-id.' }),
      details: t.Optional(t.Array(errorDetailSchema, { description: 'Rincian per field, hanya untuk VALIDATION_ERROR.' }))
    })
  },
  {
    title: 'ErrorResponse',
    description: 'Sampul error standar untuk seluruh endpoint pada API ini.'
  }
);

export type ErrorResponseBody = Static<typeof errorResponseSchema>;
export type ErrorDetail = Static<typeof errorDetailSchema>;

export function buildErrorPayload(code: ErrorCode, message: string, requestId: string): ErrorResponseBody {
  return { error: { code, message, requestId } };
}

export function buildValidationErrorPayload(
  message: string,
  requestId: string,
  details: readonly ErrorDetail[]
): ErrorResponseBody {
  return { error: { code: ERROR_CODES.VALIDATION_ERROR, message, requestId, details: [...details] } };
}
