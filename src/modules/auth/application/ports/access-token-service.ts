/**
 * Klaim access token yang dibutuhkan aplikasi. Data lain di dalam JWT diabaikan
 * supaya perluasan token di kemudian hari tidak mengubah business logic.
 */
export interface AccessTokenClaims {
  readonly userId: string;
  readonly sessionId: string;
}

export interface IssuedAccessToken {
  readonly token: string;
  readonly expiresAt: Date;
}

/**
 * Kontrak yang harus dipenuhi implementasi JWT. Application layer tidak boleh
 * tahu bahwa jose dipakai di baliknya, maupun bahwa algoritmanya HS256.
 */
export interface AccessTokenService {
  generate(input: { userId: string; sessionId: string }): Promise<IssuedAccessToken>;

  /** Mengembalikan null untuk token rusak, signature salah, atau kedaluwarsa. */
  verify(token: string): Promise<AccessTokenClaims | null>;
}
