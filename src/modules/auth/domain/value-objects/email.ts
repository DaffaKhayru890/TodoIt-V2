import { AuthError } from '../errors/auth-error';

const EMAIL_MAX_LENGTH = 320;
const LOCAL_MAX_LENGTH = 64;
const DOMAIN_MAX_LENGTH = 255;

/**
 * Aturan bentuk email disederhanakan tetapi cukup ketat untuk menolak nilai
 * yang jelas-jelas rusak: satu local part, domain berlabel dengan TLD minimal
 * dua karakter, tanpa spasi dan karakter kontrol.
 */
const EMAIL_PATTERN =
  /^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/;

export interface Email {
  readonly value: string;
}

/** Normalisasi canonical: trim whitespace lalu lowercase seluruh karakter. */
export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function toEmail(raw: string): Email {
  const normalized = normalizeEmail(raw);

  if (normalized.length === 0) {
    throw AuthError.invalidEmail('Email wajib diisi.');
  }

  if (normalized.length > EMAIL_MAX_LENGTH) {
    throw AuthError.invalidEmail(`Email tidak boleh lebih dari ${EMAIL_MAX_LENGTH} karakter.`);
  }

  const [localPart = '', ...domainLabels] = normalized.split('@');

  if (domainLabels.length !== 1) {
    throw AuthError.invalidEmail('Email harus berbentuk local@domain.');
  }

  const domain = domainLabels[0] ?? '';

  if (localPart.length > LOCAL_MAX_LENGTH) {
    throw AuthError.invalidEmail(`Bagian sebelum @ tidak boleh lebih dari ${LOCAL_MAX_LENGTH} karakter.`);
  }

  if (domain.length === 0 || domain.length > DOMAIN_MAX_LENGTH) {
    throw AuthError.invalidEmail('Domain email tidak valid.');
  }

  if (!EMAIL_PATTERN.test(normalized)) {
    throw AuthError.invalidEmail('Format email tidak dikenali.');
  }

  return { value: normalized };
}

export function emailEquals(left: Email, right: Email): boolean {
  return left.value === right.value;
}
