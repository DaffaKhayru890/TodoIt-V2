import type { Clock } from '../../../../../shared/domain/clock';
import { WorkspaceRole } from '../../../domain/enums/workspace-role';
import { WorkspaceError } from '../../../domain/errors/workspace-error';
import { WorkspaceAction } from '../../../domain/policies/workspace-authorization.policy';
import type { WorkspaceUnitOfWork } from '../../ports/workspace-unit-of-work';
import type { WorkspaceAuthorizationService } from '../../services/workspace-authorization.service';

export interface RevokeInvitationInput {
  readonly workspaceId: string;
  readonly invitationId: string;
  readonly userId: string;
}

export class RevokeInvitation {
  constructor(
    private readonly authorization: WorkspaceAuthorizationService,
    private readonly uow: WorkspaceUnitOfWork,
    private readonly clock: Clock
  ) {}

  async execute(input: RevokeInvitationInput): Promise<void> {
    const authorized = await this.authorization.authorize({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: WorkspaceAction.REVOKE_INVITATION
    });
    const now = this.clock.now();

    await this.uow.run(async (tx) => {
      const locked = await tx.lockInvitation(input.invitationId);

      if (!locked || locked.workspaceId !== input.workspaceId) {
        throw WorkspaceError.invitationNotFound();
      }

      if (authorized.role === WorkspaceRole.ADMIN) {
        if (locked.role !== WorkspaceRole.MEMBER || locked.invitedBy !== input.userId) {
          throw WorkspaceError.permissionDenied();
        }
      }

      const revoked = locked.revoke(now);

      if (revoked !== locked) {
        await tx.invitations.update(revoked);
      }
    });
  }
}
