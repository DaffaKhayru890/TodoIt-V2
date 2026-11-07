import { AuthError } from '../../domain/errors/auth-error';
import { toEmail } from '../../domain/value-objects/email';
import type { AuthSessionRepository } from '../../domain/repositories/auth-session-repository';
import type { UserRepository } from '../../domain/repositories/user-repository';
import type { LoginResult } from '../dto/auth-result-dto';
import type { AccessTokenService } from '../ports/access-token-service';
import type { Clock } from '../ports/clock';
import type { PasswordHasher } from '../ports/password-hasher';
import type { RefreshTokenGenerator } from '../ports/refresh-token-generator';
import type { TokenLifetimePolicy } from '../ports/token-lifetime-policy';
import { expiresAt } from '../services/token-expiry';
import { TIMING_EQUALIZER_HASH } from '../services/timing-equalizer';

const USER_AGENT_MAX_LENGTH = 512;

export interface LoginUserInput {
  readonly email: string;
  readonly password: string;
  readonly userAgent: string | null;
}

/**
 * Use case login: verifikasi kredensial, buka satu session baru (satu perangkat
 * bisa punya banyak session), lalu terbitkan access token dan refresh token.
 * Refresh token disimpan sebagai hash; plaintext hanya keluar sekali lewat hasil
 * use case untuk dituliskan presentation ke cookie.
 */
export class LoginUser {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: AuthSessionRepository,
    private readonly passwords: PasswordHasher,
    private readonly accessTokens: AccessTokenService,
    private readonly refreshTokenGenerator: RefreshTokenGenerator,
    private readonly policy: TokenLifetimePolicy,
    private readonly clock: Clock
  ) {}

  async execute(input: LoginUserInput): Promise<LoginResult> {
    const email = toEmail(input.email);
    const user = await this.users.findByEmail(email);

    if (!user) {
      await this.passwords.verify(input.password, TIMING_EQUALIZER_HASH);
      throw AuthError.invalidCredentials();
    }

    if (!(await this.passwords.verify(input.password, user.passwordHash))) {
      throw AuthError.invalidCredentials();
    }

    const now = this.clock.now();
    // Umur session dan refresh token disamakan: session adalah perangkat, dan
    // refresh token adalah bukti bahwa perangkat itu masih dikenal.
    const refreshExpiresAt = expiresAt(now, this.policy.refreshTokenTtlSeconds);
    const generatedToken = await this.refreshTokenGenerator.generate();

    const { session } = await this.sessions.startSession({
      userId: user.id,
      hash: generatedToken.hash,
      sessionExpiresAt: refreshExpiresAt,
      tokenExpiresAt: refreshExpiresAt,
      userAgent: input.userAgent ? input.userAgent.slice(0, USER_AGENT_MAX_LENGTH) : null,
      now
    });

    const accessToken = await this.accessTokens.generate({ userId: user.id, sessionId: session.id });

    return {
      user: { id: user.id, email: user.email.value, displayName: user.displayName },
      accessToken: accessToken.token,
      tokenType: 'Bearer',
      expiresIn: this.policy.accessTokenTtlSeconds,
      refreshCookieToken: generatedToken.token,
      refreshCookieExpiresAt: refreshExpiresAt
    };
  }
}
