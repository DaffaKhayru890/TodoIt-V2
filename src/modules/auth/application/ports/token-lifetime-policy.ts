/**
 * Umur token dinyatakan sebagai policy terpisah agar use case tidak bergantung
 * pada bentuk AppConfig; composition root yang memetakan konfigurasi ke sini.
 */
export interface TokenLifetimePolicy {
  readonly accessTokenTtlSeconds: number;
  readonly refreshTokenTtlSeconds: number;
}
