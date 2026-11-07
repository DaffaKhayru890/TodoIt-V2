/**
 * Validasi IANA timezone memakai Intl, bukan tabel offset buatan sendiri.
 *
 * Intl menolak string seperti "Asia/Jakarta+7" maupun offset tetap, sehingga
 * hanya identifier IANA yang benar-benar dikenal runtime yang lolos.
 */
export function isValidTimeZone(timeZone: string): boolean {
  const candidate = timeZone.trim();

  if (candidate.length === 0 || candidate.length > 64) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: candidate }).format(new Date(0));
    return true;
  } catch {
    return false;
  }
}
