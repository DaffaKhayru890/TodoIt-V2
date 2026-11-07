import type { AuthSessionRepository } from '../../domain/repositories/auth-session-repository';
import type { Clock } from '../ports/clock';
import type { RefreshTokenGenerator } from '../ports/refresh-token-generator';
import { noopAuditRecorder, safeRecord, type AuditRecorder } from '../../../../shared/application/audit-recorder';

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
    private readonly clock: Clock,
    private readonly audit: AuditRecorder = noopAuditRecorder
  ) {}

  async execute(input: LogoutUserInput): Promise<void> {
    if (!input.refreshToken) {
      return;
    }

    const now = this.clock.now();
    const hash = await this.refreshTokenGenerator.hash(input.refreshToken);
    await this.sessions.revokeSessionByRefreshToken({
      hash,
      now
    });
    await safeRecord(this.audit, {
      actorUserId: null,
      action: 'auth.session_revoke',
      resourceType: 'session',
      resourceId: null,
      workspaceId: null,
      requestId: null,
      outcome: 'success',
      metadata: {},
      occurredAt: now
    });
  }
}
