import { AuthError } from '../../domain/errors/auth-error';

const BEARER_PREFIX_PATTERN = /^bearer\s+(.+)$/i;

/**
 * Membaca access token dari header Authorization. Presentation layer hanya
 * meneruskan nilai header mentah; format scheme adalah aturan autentikasi sehingga
 * dianalisis di application layer dan bisa diuji tanpa HTTP.
 */
export function readBearerToken(authorizationHeader: string | null | undefined): string {
  const match = authorizationHeader?.trim().match(BEARER_PREFIX_PATTERN);
  const token = match?.[1]?.trim();

  if (!token) {
    throw AuthError.unauthorized('Header Authorization harus berbentuk "Bearer <access token>".');
  }

  return token;
}
