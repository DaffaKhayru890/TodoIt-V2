import { WorkspaceRole } from '../../../domain/enums/workspace-role';
import { WorkspaceError } from '../../../domain/errors/workspace-error';
import { WorkspaceAction } from '../../../domain/policies/workspace-authorization.policy';
import type { WorkspaceUnitOfWork } from '../../ports/workspace-unit-of-work';
import type { WorkspaceAuthorizationService } from '../../services/workspace-authorization.service';

export class RemoveMember {
  constructor(
    private readonly authorization: WorkspaceAuthorizationService,
    private readonly uow: WorkspaceUnitOfWork
  ) {}

  async execute(input: { workspaceId: string; actorId: string; memberUserId: string }): Promise<void> {
    const authorized = await this.authorization.authorize({
      workspaceId: input.workspaceId,
      userId: input.actorId,
      action: WorkspaceAction.REMOVE_MEMBER
    });

    if (input.actorId === input.memberUserId) {
      throw authorized.role === WorkspaceRole.OWNER
        ? WorkspaceError.ownerTransferRequired()
        : WorkspaceError.memberPermissionDenied('Gunakan leave untuk keluar dari workspace.');
    }

    await this.uow.run(async (tx) => {
      await tx.lockWorkspace(input.workspaceId);
      const target = await tx.members.find(input.workspaceId, input.memberUserId);

      if (!target) {
        throw WorkspaceError.memberNotFound();
      }

      if (target.role === WorkspaceRole.OWNER) {
        throw WorkspaceError.memberPermissionDenied('Owner tidak dapat dihapus tanpa transfer kepemilikan.');
      }

      if (authorized.role === WorkspaceRole.ADMIN && target.role !== WorkspaceRole.MEMBER) {
        throw WorkspaceError.memberPermissionDenied('Admin hanya dapat menghapus member.');
      }

      await tx.members.delete(input.workspaceId, input.memberUserId);
    });
  }
}
