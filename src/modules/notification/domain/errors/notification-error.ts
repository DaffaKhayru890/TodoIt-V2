import { ApplicationError } from '../../../../shared/domain/errors/application-error';

export class NotificationError extends ApplicationError {
  private constructor(code: string, message: string) {
    super(code, message);
  }

  static notFound(): NotificationError {
    return new NotificationError('NOTIFICATION_NOT_FOUND', 'Notifikasi tidak ditemukan.');
  }

  static validation(message: string): NotificationError {
    return new NotificationError('VALIDATION_ERROR', message);
  }

  static invalidCursor(): NotificationError {
    return new NotificationError('INVALID_CURSOR', 'Cursor tidak valid atau tidak sesuai dengan filter.');
  }
}

export class NotificationJobError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'NotificationJobError';
    this.code = code;
  }
}
