import { AuthError } from '../../domain/errors/auth-error';
import type { AuthSessionRepository } from '../../domain/repositories/auth-session-repository';
import type { RefreshResult } from '../dto/auth-result-dto';
import type { AccessTokenService } from '../ports/access-token-service';
import type { Clock } from '../ports/clock';
import type { RefreshTokenGenerator } from '../ports/refresh-token-generator';
import type { SecurityLog } from '../ports/security-log';
import type { TokenLifetimePolicy } from '../ports/token-lifetime-policy';
import { expiresAt } from '../services/token-expiry';

/**
 * Use case refresh: rotasikan refresh token dan terbitkan access token baru.
 * Seluruh langkah penyimpanan terjadi di dalam satu transaksi repository, jadi
 * dua request bersamaan tidak bisa sama-sama berhasil memakai token yang sama.
 *
 * Umur session tidak diperpanjang saat refresh: session punya masa berlaku tetap
 * sejak dibuat, dan rotasi hanya mengganti bukti kepemilikan perangkat.
 */
export class RefreshSession {
  constructor(
    private readonly sessions: AuthSessionRepository,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokenGenerator: RefreshTokenGenerator,
    private readonly policy: TokenLifetimePolicy,
    private readonly clock: Clock,
    private readonly securityLog: SecurityLog
  ) {}

  async execute(input: { refreshToken: string | null | undefined }): Promise<RefreshResult> {
    if (!input.refreshToken) {
      throw AuthError.invalidRefreshToken();
    }

    const now = this.clock.now();
    const replacementExpiresAt = expiresAt(now, this.policy.refreshTokenTtlSeconds);
    const [presentedHash, replacement] = await Promise.all([
      this.refreshTokenGenerator.hash(input.refreshToken),
      this.refreshTokenGenerator.generate()
    ]);

    const outcome = await this.sessions.rotateRefreshToken({
      presentedHash,
      replacementHash: replacement.hash,
      tokenExpiresAt: replacementExpiresAt,
      now
    });

    if (outcome.status === 'reused') {
      // Sinyalemen token dicuri: cabut seluruh session user, dan balas dengan
      // error generik agar penyerang tidak tahu bahwa reuse-nya terdeteksi.
      this.securityLog.warn('refresh token reuse detected', {
        userId: outcome.userId,
        revokedSessionCount: outcome.revokedSessionCount
      });

      throw AuthError.invalidRefreshToken();
    }

    if (outcome.status !== 'rotated') {
      throw refreshErrorFor(outcome.status);
    }

    const accessToken = await this.accessTokens.generate({
      userId: outcome.session.userId,
      sessionId: outcome.session.id
    });

    return {
      accessToken: accessToken.token,
      tokenType: 'Bearer',
      expiresIn: this.policy.accessTokenTtlSeconds,
      refreshCookieToken: replacement.token,
      refreshCookieExpiresAt: replacementExpiresAt
    };
  }
}

function refreshErrorFor(status: 'unknown-token' | 'token-expired' | 'session-expired' | 'session-revoked'): AuthError {
  switch (status) {
    case 'unknown-token':
    case 'token-expired':
      return AuthError.invalidRefreshToken();
    case 'session-expired':
      return AuthError.sessionExpired();
    case 'session-revoked':
      return AuthError.sessionRevoked();
  }
}
