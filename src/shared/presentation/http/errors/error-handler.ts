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
    case 'TODO_NOT_FOUND':
    case 'TAG_NOT_FOUND':
    case 'LABEL_NOT_FOUND':
    case 'REMINDER_NOT_FOUND':
    case 'TAG_WORKSPACE_MISMATCH':
    case 'LABEL_WORKSPACE_MISMATCH':
    case 'REMINDER_WORKSPACE_MISMATCH':
      return 404;

    case 'INVALID_CURSOR':
      return 400;

    case 'EMAIL_ALREADY_EXISTS':
    case 'TAG_ALREADY_EXISTS':
    case 'LABEL_ALREADY_EXISTS':
    case 'REMINDER_DUPLICATE':
    case 'REMINDER_SCHEDULE_CONFLICT':
    case 'REMINDER_ALREADY_CANCELLED':
    case 'TODO_HAS_RELATIVE_REMINDERS':
    case 'TODO_DUE_DATE_CONFLICTS_WITH_REMINDERS':
      return 409;

    case 'INVALID_EMAIL':
    case 'INVALID_PASSWORD':
    case 'WORKSPACE_NAME_INVALID':
    case 'TODO_TITLE_REQUIRED':
    case 'TODO_TITLE_TOO_LONG':
    case 'TODO_DESCRIPTION_TOO_LONG':
    case 'TODO_STATUS_INVALID':
    case 'TODO_PRIORITY_INVALID':
    case 'TODO_DUE_DATE_INVALID':
    case 'TODO_LABEL_ASSIGNMENT_INVALID':
    case 'TODO_TAG_ASSIGNMENT_INVALID':
    case 'TAG_NAME_REQUIRED':
    case 'TAG_NAME_INVALID':
    case 'TAG_NAME_TOO_LONG':
    case 'TAG_LIMIT_EXCEEDED':
    case 'TAG_ASSIGNMENT_INVALID':
    case 'LABEL_NAME_REQUIRED':
    case 'LABEL_NAME_INVALID':
    case 'LABEL_NAME_TOO_LONG':
    case 'LABEL_COLOR_INVALID':
    case 'LABEL_DESCRIPTION_TOO_LONG':
    case 'REMINDER_TRIGGER_TYPE_INVALID':
    case 'REMINDER_TIME_INVALID':
    case 'REMINDER_TIME_IN_PAST':
    case 'REMINDER_OFFSET_INVALID':
    case 'REMINDER_TODO_INELIGIBLE':
    case 'REMINDER_DUE_DATE_REQUIRED':
    case 'INVALID_DATE_RANGE':
    case 'INVALID_TIMEZONE':
    case 'INVALID_UPCOMING_RANGE':
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
