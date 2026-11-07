import { WorkspaceRole } from '../../../domain/enums/workspace-role';
import { WorkspaceError } from '../../../domain/errors/workspace-error';
import { WorkspaceAction } from '../../../domain/policies/workspace-authorization.policy';
import type { WorkspaceUnitOfWork } from '../../ports/workspace-unit-of-work';
import type { WorkspaceAuthorizationService } from '../../services/workspace-authorization.service';

export class LeaveWorkspace {
  constructor(
    private readonly authorization: WorkspaceAuthorizationService,
    private readonly uow: WorkspaceUnitOfWork
  ) {}

  async execute(input: { workspaceId: string; userId: string }): Promise<void> {
    const authorized = await this.authorization.authorize({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: WorkspaceAction.LEAVE_WORKSPACE
    });

    if (authorized.role === WorkspaceRole.OWNER) {
      throw WorkspaceError.ownerTransferRequired();
    }

    await this.uow.run(async (tx) => {
      const current = await tx.members.find(input.workspaceId, input.userId);

      if (!current) {
        return;
      }

      if (current.role === WorkspaceRole.OWNER) {
        throw WorkspaceError.ownerTransferRequired();
      }

      await tx.members.delete(input.workspaceId, input.userId);
    });
  }
}
