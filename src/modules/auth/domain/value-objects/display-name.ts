import { AuthError } from '../errors/auth-error';

export const DISPLAY_NAME_MAX_LENGTH = 80;

/**
 * Display name dipakai hanya untuk ditampilkan, jadi whitespace pinggir dan
 * spasi ganda di dalam string dirapikan. Nilai hasil rapikan wajib masih berada
 * dalam batas kolom database.
 */
export function toDisplayName(raw: string): string {
  const normalized = raw.trim().replace(/\s+/g, ' ');

  if (normalized.length === 0) {
    throw AuthError.invalidDisplayName('displayName wajib diisi.');
  }

  if (normalized.length > DISPLAY_NAME_MAX_LENGTH) {
    throw AuthError.invalidDisplayName(`displayName tidak boleh lebih dari ${DISPLAY_NAME_MAX_LENGTH} karakter.`);
  }

  return normalized;
}
