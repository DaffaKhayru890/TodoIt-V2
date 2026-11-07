import { ApplicationError } from '../../../../shared/domain/errors/application-error';

export const WORKSPACE_ERROR_CODES = [
  'WORKSPACE_NOT_FOUND',
  'WORKSPACE_ACCESS_DENIED',
  'WORKSPACE_PERMISSION_DENIED',
  'WORKSPACE_NAME_INVALID',
  'VALIDATION_ERROR'
] as const;

export type WorkspaceErrorCode = (typeof WORKSPACE_ERROR_CODES)[number];

export class WorkspaceError extends ApplicationError {
  readonly code: WorkspaceErrorCode;

  private constructor(code: WorkspaceErrorCode, message: string) {
    super(code, message);
    this.code = code;
  }

  static notFound(): WorkspaceError {
    return new WorkspaceError('WORKSPACE_NOT_FOUND', 'Workspace tidak ditemukan.');
  }

  /**
   * Mengembalikan 404 pada HTTP layer untuk mencegah enumerasi resource milik user lain.
   */
  static accessDenied(): WorkspaceError {
    return new WorkspaceError('WORKSPACE_ACCESS_DENIED', 'Workspace tidak ditemukan.');
  }

  static permissionDenied(): WorkspaceError {
    return new WorkspaceError(
      'WORKSPACE_PERMISSION_DENIED',
      'Hanya owner yang berhak melakukan tindakan ini.'
    );
  }

  static invalidName(message = 'Nama workspace wajib diisi (1-100 karakter).'): WorkspaceError {
    return new WorkspaceError('WORKSPACE_NAME_INVALID', message);
  }

  static validationError(message: string): WorkspaceError {
    return new WorkspaceError('VALIDATION_ERROR', message);
  }
}
