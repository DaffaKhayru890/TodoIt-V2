import { AuthError } from '../../domain/errors/auth-error';
import { isSessionExpired, isSessionRevoked } from '../../domain/entities/auth-session';
import type { AuthSessionRepository } from '../../domain/repositories/auth-session-repository';
import type { UserRepository } from '../../domain/repositories/user-repository';
import type { AuthenticatedUser } from '../dto/authenticated-user';
import type { AccessTokenService } from '../ports/access-token-service';
import type { Clock } from '../ports/clock';
import { readBearerToken } from '../services/authorization-header';

/**
 * Use case "siapa saya": satu-satunya jalur yang dipakai middleware dan endpoint
 * /me. Identity selalu berasal dari token yang sudah diverifikasi — tidak pernah
 * dari body, query, maupun header lain.
 *
 * Session ikut diperiksa, sehingga access token yang belum kedaluwarsa tetap
 * ditolak begitu session-nya dicabut (logout atau reuse detection).
 */
export class GetCurrentUser {
  constructor(
    private readonly users: UserRepository,
    private readonly sessions: AuthSessionRepository,
    private readonly accessTokens: AccessTokenService,
    private readonly clock: Clock
  ) {}

  async execute(input: { authorizationHeader: string | null | undefined }): Promise<AuthenticatedUser> {
    const token = readBearerToken(input.authorizationHeader);
    const claims = await this.accessTokens.verify(token);

    if (!claims) {
      throw AuthError.invalidAccessToken();
    }

    const session = await this.sessions.findSessionById(claims.sessionId);

    if (!session) {
      throw AuthError.invalidAccessToken();
    }

    if (isSessionRevoked(session)) {
      throw AuthError.sessionRevoked();
    }

    const now = this.clock.now();

    if (isSessionExpired(session, now)) {
      throw AuthError.sessionExpired();
    }

    const user = await this.users.findById(claims.userId);

    if (!user) {
      throw AuthError.userNotFound();
    }

    await this.sessions.markSessionUsed(session.id, now);

    return { id: user.id, email: user.email.value, displayName: user.displayName };
  }
}
