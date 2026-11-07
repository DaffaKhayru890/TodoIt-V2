import type { Clock } from '../../../../../shared/domain/clock';
import { InvitationStatus } from '../../../domain/enums/invitation-status';
import { WorkspaceRole } from '../../../domain/enums/workspace-role';
import { WorkspaceError } from '../../../domain/errors/workspace-error';
import { WorkspaceAction } from '../../../domain/policies/workspace-authorization.policy';
import type { WorkspaceInvitationRepository } from '../../../domain/repositories/workspace-invitation.repository';
import { toInvitationDto, type InvitationDto } from '../../dto/invitation.dto';
import type { InvitationEmailSender } from '../../ports/invitation-email.sender';
import type { InvitationTokenGenerator } from '../../ports/invitation-token.generator';
import type { WorkspaceUnitOfWork } from '../../ports/workspace-unit-of-work';
import { deliverInvitationEmail } from '../../services/invitation-mailer';
import type { WorkspaceAuthorizationService } from '../../services/workspace-authorization.service';

export interface ResendInvitationInput {
  readonly workspaceId: string;
  readonly invitationId: string;
  readonly userId: string;
  readonly inviterName: string;
}

export class ResendInvitation {
  constructor(
    private readonly authorization: WorkspaceAuthorizationService,
    private readonly uow: WorkspaceUnitOfWork,
    private readonly invitations: WorkspaceInvitationRepository,
    private readonly tokens: InvitationTokenGenerator,
    private readonly emailSender: InvitationEmailSender,
    private readonly clock: Clock,
    private readonly webAppUrl: string,
    private readonly ttlSeconds: number
  ) {}

  async execute(input: ResendInvitationInput): Promise<{ invitation: InvitationDto }> {
    const authorized = await this.authorization.authorize({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: WorkspaceAction.RESEND_INVITATION
    });
    const generated = await this.tokens.generate();
    const now = this.clock.now();
    const expiresAt = new Date(now.getTime() + this.ttlSeconds * 1000);
    const rotated = await this.uow.run(async (tx) => {
      const locked = await tx.lockInvitation(input.invitationId);

      if (!locked || locked.workspaceId !== input.workspaceId) {
        throw WorkspaceError.invitationNotFound();
      }

      if (authorized.role === WorkspaceRole.ADMIN) {
        if (locked.role !== WorkspaceRole.MEMBER || locked.invitedBy !== input.userId) {
          throw WorkspaceError.invitationResendNotAllowed();
        }
      }

      const status = locked.effectiveStatus(now);
      const current = status === InvitationStatus.EXPIRED ? locked.expire(now) : locked;

      if (status !== InvitationStatus.PENDING && status !== InvitationStatus.EXPIRED) {
        throw status === InvitationStatus.ACCEPTED
          ? WorkspaceError.invitationAlreadyAccepted()
          : status === InvitationStatus.REVOKED
            ? WorkspaceError.invitationAlreadyRevoked()
            : WorkspaceError.invitationAlreadyDeclined();
      }

      const next = current.rotateToken(generated.tokenHash, expiresAt, now);
      const saved = await tx.invitations.update(next);

      return saved ?? next;
    });
    const delivered = await deliverInvitationEmail({
      invitation: rotated,
      token: generated.token,
      inviterName: input.inviterName,
      workspaceName: authorized.workspace.name,
      webAppUrl: this.webAppUrl,
      sender: this.emailSender,
      invitations: this.invitations,
      clock: this.clock
    });

    return { invitation: toInvitationDto(delivered, this.clock.now()) };
  }
}
