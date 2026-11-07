export interface GeneratedRefreshToken {
  /** Token opaque yang dikirim ke klien lewat HttpOnly cookie. */
  readonly token: string;
  /** Representasi yang disimpan di database; plaintext tidak pernah persisten. */
  readonly hash: string;
}

/**
 * Generator refresh token: token acak dengan entropy kryptografis dan hash
 * deterministik untuk lookup. Implementasi memakai Web Crypto, bukan
 * timestamp maupun identifier user.
 */
export interface RefreshTokenGenerator {
  generate(): Promise<GeneratedRefreshToken>;

  hash(token: string): Promise<string>;
}
