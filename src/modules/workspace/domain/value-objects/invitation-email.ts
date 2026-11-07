import { WorkspaceError } from '../errors/workspace-error';

const EMAIL_MAX_LENGTH = 320;
const EMAIL_PATTERN =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export interface InvitationEmail {
  /** Bentuk yang ditampilkan, sudah di-trim, huruf asli dipertahankan. */
  readonly email: string;
  /** Trim + lowercase. Dipakai untuk uniqueness dan pencocokan akun. */
  readonly normalizedEmail: string;
}

/**
 * Normalisasi undangan: trim dan lowercase. Titik atau suffix milik penyedia
 * email tidak dihapus.
 */
export function toInvitationEmail(raw: unknown): InvitationEmail {
  if (typeof raw !== 'string') {
    throw WorkspaceError.validationError('Email undangan harus berupa string.');
  }

  const email = raw.trim();
  const normalizedEmail = email.toLowerCase();

  if (normalizedEmail.length === 0) {
    throw WorkspaceError.validationError('Email undangan wajib diisi.');
  }

  if (normalizedEmail.length > EMAIL_MAX_LENGTH) {
    throw WorkspaceError.validationError(`Email undangan maksimal ${EMAIL_MAX_LENGTH} karakter.`);
  }

  if (!EMAIL_PATTERN.test(normalizedEmail)) {
    throw WorkspaceError.validationError('Format email undangan tidak dikenali.');
  }

  return { email, normalizedEmail };
}
