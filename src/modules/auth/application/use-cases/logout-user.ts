import type { AuthSessionRepository } from '../../domain/repositories/auth-session-repository';
import type { Clock } from '../ports/clock';
import type { RefreshTokenGenerator } from '../ports/refresh-token-generator';

export interface LogoutUserInput {
  readonly refreshToken: string | null | undefined;
}

/**
 * Use case logout: mencabut session yang berasosiasi dengan refresh token.
 * Bersifat idempoten dan aman bila dipanggil berulang kali atau dengan token yang sudah dicabut.
 */
export class LogoutUser {
  constructor(
    private readonly sessions: AuthSessionRepository,
    private readonly refreshTokenGenerator: RefreshTokenGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: LogoutUserInput): Promise<void> {
    if (!input.refreshToken) {
      return;
    }

    const hash = await this.refreshTokenGenerator.hash(input.refreshToken);
    await this.sessions.revokeSessionByRefreshToken({
      hash,
      now: this.clock.now()
    });
  }
}
