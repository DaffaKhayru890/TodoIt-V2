/**
 * Identity yang diakui sistem setelah access token diverifikasi. Kolom ini sengaja
 * minimal: tidak ada passwordHash, tidak ada token, dan tidak ada data internal lain.
 */
export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string;
}
