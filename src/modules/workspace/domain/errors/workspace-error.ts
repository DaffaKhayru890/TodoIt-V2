import { ApplicationError } from '../../../../shared/domain/errors/application-error';

export const WORKSPACE_ERROR_CODES = [
  'WORKSPACE_NOT_FOUND',
  'WORKSPACE_ACCESS_DENIED',
  'WORKSPACE_PERMISSION_DENIED',
  'WORKSPACE_NAME_INVALID',
  'VALIDATION_ERROR',
  'INVALID_CURSOR',
  'INVITATION_NOT_FOUND',
  'INVITATION_ALREADY_PENDING',
  'INVITATION_ALREADY_ACCEPTED',
  'INVITATION_ALREADY_DECLINED',
  'INVITATION_ALREADY_REVOKED',
  'INVITATION_EXPIRED',
  'INVITATION_TOKEN_INVALID',
  'INVITATION_EMAIL_MISMATCH',
  'INVITATION_ROLE_INVALID',
  'INVITATION_DELIVERY_FAILED',
  'INVITATION_RESEND_NOT_ALLOWED',
  'WORKSPACE_MEMBER_ALREADY_EXISTS',
  'WORKSPACE_MEMBER_NOT_FOUND',
  'WORKSPACE_MEMBER_PERMISSION_DENIED',
  'WORKSPACE_MEMBER_ALREADY_REMOVED',
  'OWNER_TRANSFER_REQUIRED',
  'OWNERSHIP_TRANSFER_INVALID',
  'OWNERSHIP_TRANSFER_FAILED'
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

  static invalidCursor(): WorkspaceError {
    return new WorkspaceError('INVALID_CURSOR', 'Cursor tidak valid atau tidak sesuai dengan filter.');
  }

  static invitationNotFound(): WorkspaceError {
    return new WorkspaceError('INVITATION_NOT_FOUND', 'Undangan tidak ditemukan.');
  }

  static invitationAlreadyPending(): WorkspaceError {
    return new WorkspaceError(
      'INVITATION_ALREADY_PENDING',
      'Masih ada undangan pending untuk email tersebut pada workspace ini.'
    );
  }

  static invitationAlreadyAccepted(): WorkspaceError {
    return new WorkspaceError('INVITATION_ALREADY_ACCEPTED', 'Undangan sudah diterima.');
  }

  static invitationAlreadyDeclined(): WorkspaceError {
    return new WorkspaceError('INVITATION_ALREADY_DECLINED', 'Undangan sudah ditolak.');
  }

  static invitationAlreadyRevoked(): WorkspaceError {
    return new WorkspaceError('INVITATION_ALREADY_REVOKED', 'Undangan sudah dicabut.');
  }

  static invitationExpired(): WorkspaceError {
    return new WorkspaceError('INVITATION_EXPIRED', 'Undangan sudah kedaluwarsa.');
  }

  static invitationTokenInvalid(): WorkspaceError {
    return new WorkspaceError('INVITATION_TOKEN_INVALID', 'Token undangan tidak valid.');
  }

  static invitationEmailMismatch(): WorkspaceError {
    return new WorkspaceError(
      'INVITATION_EMAIL_MISMATCH',
      'Email akun yang login tidak sama dengan email undangan.'
    );
  }

  static invitationRoleInvalid(): WorkspaceError {
    return new WorkspaceError(
      'INVITATION_ROLE_INVALID',
      'Role undangan hanya boleh admin atau member.'
    );
  }

  static invitationDeliveryFailed(): WorkspaceError {
    return new WorkspaceError(
      'INVITATION_DELIVERY_FAILED',
      'Undangan tersimpan, tetapi email gagal dikirim. Gunakan resend untuk mencoba lagi.'
    );
  }

  static invitationResendNotAllowed(): WorkspaceError {
    return new WorkspaceError('INVITATION_RESEND_NOT_ALLOWED', 'Undangan ini tidak dapat dikirim ulang.');
  }

  static memberAlreadyExists(): WorkspaceError {
    return new WorkspaceError(
      'WORKSPACE_MEMBER_ALREADY_EXISTS',
      'Pengguna tersebut sudah menjadi anggota workspace.'
    );
  }

  static memberNotFound(): WorkspaceError {
    return new WorkspaceError('WORKSPACE_MEMBER_NOT_FOUND', 'Anggota workspace tidak ditemukan.');
  }

  static memberPermissionDenied(message = 'Anda tidak berhak mengubah anggota ini.'): WorkspaceError {
    return new WorkspaceError('WORKSPACE_MEMBER_PERMISSION_DENIED', message);
  }

  static memberAlreadyRemoved(): WorkspaceError {
    return new WorkspaceError('WORKSPACE_MEMBER_ALREADY_REMOVED', 'Anggota tersebut sudah tidak ada di workspace.');
  }

  static ownerTransferRequired(): WorkspaceError {
    return new WorkspaceError(
      'OWNER_TRANSFER_REQUIRED',
      'Owner harus memindahkan kepemilikan sebelum meninggalkan workspace.'
    );
  }

  static ownershipTransferInvalid(message = 'Perpindahan kepemilikan tidak valid.'): WorkspaceError {
    return new WorkspaceError('OWNERSHIP_TRANSFER_INVALID', message);
  }

  static ownershipTransferFailed(): WorkspaceError {
    return new WorkspaceError('OWNERSHIP_TRANSFER_FAILED', 'Perpindahan kepemilikan gagal dan dibatalkan.');
  }
}
