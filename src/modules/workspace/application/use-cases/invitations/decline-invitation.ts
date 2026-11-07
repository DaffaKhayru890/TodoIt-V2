import type { Clock } from '../../../../../shared/domain/clock';
import { InvitationStatus } from '../../../domain/enums/invitation-status';
import { WorkspaceError } from '../../../domain/errors/workspace-error';
import { toInvitationDto, type InvitationDto } from '../../dto/invitation.dto';
import type { InvitationTokenGenerator } from '../../ports/invitation-token.generator';
import type { WorkspaceUnitOfWork } from '../../ports/workspace-unit-of-work';

export interface DeclineInvitationInput {
  readonly invitationId: string;
  readonly email: string;
  readonly token: string;
}

export class DeclineInvitation {
  constructor(
    private readonly uow: WorkspaceUnitOfWork,
    private readonly tokens: InvitationTokenGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: DeclineInvitationInput): Promise<{ invitation: InvitationDto }> {
    if (input.token.trim().length === 0) {
      throw WorkspaceError.invitationTokenInvalid();
    }

    const tokenHash = await this.tokens.hash(input.token);
    const normalizedEmail = input.email.trim().toLowerCase();
    const now = this.clock.now();
    const invitation = await this.uow.run(async (tx) => {
      const locked = await tx.lockInvitation(input.invitationId);

      if (!locked) {
        throw WorkspaceError.invitationNotFound();
      }

      if (!locked.matchesTokenHash(tokenHash)) {
        throw WorkspaceError.invitationTokenInvalid();
      }

      if (locked.normalizedEmail !== normalizedEmail) {
        throw WorkspaceError.invitationEmailMismatch();
      }

      if (locked.status === InvitationStatus.DECLINED) {
        return locked;
      }

      if (locked.effectiveStatus(now) === InvitationStatus.EXPIRED) {
        await tx.invitations.update(locked.expire(now));
        throw WorkspaceError.invitationExpired();
      }

      const workspace = await tx.lockWorkspace(locked.workspaceId);

      if (!workspace) {
        throw WorkspaceError.accessDenied();
      }

      const declined = locked.decline(now);
      const saved = await tx.invitations.update(declined);

      return saved ?? declined;
    });

    return { invitation: toInvitationDto(invitation, now) };
  }
}
