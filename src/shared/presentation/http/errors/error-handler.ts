import { NotFoundError, ParseError, ValidationError } from 'elysia/error';
import { isApplicationError } from '../../../domain/errors/application-error';
import {
  ERROR_CODES,
  buildErrorPayload,
  buildValidationErrorPayload,
  type ErrorCode,
  type ErrorDetail,
  type ErrorResponseBody
} from './error-response';

export interface MappedHttpError {
  readonly status: number;
  readonly payload: ErrorResponseBody;
}

export interface MapErrorInput {
  readonly error: unknown;
  /** Kode error dari Elysia, misalnya 'VALIDATION' | 'NOT_FOUND' | 'UNKNOWN'. */
  readonly code: string | number;
  readonly requestId: string;
}

const MAX_VALIDATION_DETAILS = 10;

function mapApplicationErrorCodeToStatus(code: string): number {
  switch (code) {
    case 'INVALID_CREDENTIALS':
    case 'UNAUTHORIZED':
    case 'INVALID_ACCESS_TOKEN':
    case 'INVALID_REFRESH_TOKEN':
    case 'SESSION_EXPIRED':
    case 'SESSION_REVOKED':
      return 401;

    case 'WORKSPACE_PERMISSION_DENIED':
      return 403;

    case 'USER_NOT_FOUND':
    case 'WORKSPACE_NOT_FOUND':
    case 'WORKSPACE_ACCESS_DENIED':
      return 404;

    case 'EMAIL_ALREADY_EXISTS':
      return 409;

    case 'INVALID_EMAIL':
    case 'INVALID_PASSWORD':
    case 'WORKSPACE_NAME_INVALID':
    case 'VALIDATION_ERROR':
      return 422;

    case 'SERVICE_UNAVAILABLE':
      return 503;

    default:
      return 500;
  }
}

/**
 * Mengubah error apa pun menjadi sampul HTTP yang aman: tanpa stack trace,
 * tanpa SQL, tanpa kredensial, dan tanpa pesan exception internal.
 * Error yang tidak dikenal selalu menjadi 500 generik.
 */
export function mapErrorToHttpResponse({ error, code, requestId }: MapErrorInput): MappedHttpError {
  if (isApplicationError(error)) {
    const status = mapApplicationErrorCodeToStatus(error.code);
    const validCode = (Object.values(ERROR_CODES).includes(error.code as any)
      ? error.code
      : ERROR_CODES.INTERNAL_SERVER_ERROR) as ErrorCode;

    return {
      status,
      payload: buildErrorPayload(validCode, error.message, requestId)
    };
  }

  if (error instanceof ValidationError) {
    return {
      status: 422,
      payload: buildValidationErrorPayload('Permintaan tidak lolos validasi skema.', requestId, describeValidationErrors(error))
    };
  }

  if (error instanceof ParseError || code === 'PARSE') {
    return {
      status: 400,
      payload: buildErrorPayload(ERROR_CODES.BAD_REQUEST, 'Body permintaan tidak dapat dibaca sebagai JSON yang valid.', requestId)
    };
  }

  if (error instanceof NotFoundError || code === 'NOT_FOUND') {
    return {
      status: 404,
      payload: buildErrorPayload(ERROR_CODES.NOT_FOUND, 'Endpoint yang diminta tidak tersedia.', requestId)
    };
  }

  return {
    status: 500,
    payload: buildErrorPayload(ERROR_CODES.INTERNAL_SERVER_ERROR, 'An unexpected error occurred', requestId)
  };
}

/**
 * TypeBox sudah menyebutkan path dan ekspektasi tipe; nilai input yang ditolak
 * sengaja tidak disertakan agar respons error tidak memuat data klien.
 */
function describeValidationErrors(error: ValidationError): readonly ErrorDetail[] {
  return error.all.slice(0, MAX_VALIDATION_DETAILS).map((valueError) => ({
    path: normalizePath(valueError.path ?? error.type),
    message: valueError.summary ?? valueError.message
  }));
}

function normalizePath(path: string): string {
  const withoutLeadingSlash = path.replace(/^\//, '');

  return withoutLeadingSlash.length > 0 ? withoutLeadingSlash.replace(/\//g, '.') : 'body';
}
