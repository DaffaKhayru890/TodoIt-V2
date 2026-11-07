import { WorkspaceRole } from '../../../domain/enums/workspace-role';
import { WorkspaceError } from '../../../domain/errors/workspace-error';
import { WorkspaceAction } from '../../../domain/policies/workspace-authorization.policy';
import type { WorkspaceUnitOfWork } from '../../ports/workspace-unit-of-work';
import type { WorkspaceAuthorizationService } from '../../services/workspace-authorization.service';

export interface TransferOwnershipResult {
  readonly workspace: { readonly id: string };
  readonly ownership: {
    readonly previousOwner: { readonly userId: string; readonly role: 'admin' };
    readonly newOwner: { readonly userId: string; readonly role: 'owner' };
  };
}

export class TransferOwnership {
  constructor(
    private readonly authorization: WorkspaceAuthorizationService,
    private readonly uow: WorkspaceUnitOfWork
  ) {}

  async execute(input: {
    workspaceId: string;
    actorId: string;
    newOwnerUserId: string;
  }): Promise<TransferOwnershipResult> {
    await this.authorization.authorize({
      workspaceId: input.workspaceId,
      userId: input.actorId,
      action: WorkspaceAction.TRANSFER_OWNERSHIP
    });

    if (input.actorId === input.newOwnerUserId) {
      throw WorkspaceError.ownershipTransferInvalid('Owner tidak dapat memindahkan kepemilikan kepada dirinya sendiri.');
    }

    await this.uow.run(async (tx) => {
      const workspace = await tx.lockWorkspace(input.workspaceId);

      if (!workspace || workspace.archivedAt !== null) {
        throw WorkspaceError.accessDenied();
      }

      const current = await tx.members.find(input.workspaceId, input.actorId);
      const target = await tx.members.find(input.workspaceId, input.newOwnerUserId);

      if (!current || current.role !== WorkspaceRole.OWNER) {
        throw WorkspaceError.permissionDenied();
      }

      if (!target) {
        throw WorkspaceError.memberNotFound();
      }

      const demoted = await tx.members.updateRole(input.workspaceId, input.actorId, WorkspaceRole.ADMIN);

      if (!demoted) {
        throw WorkspaceError.ownershipTransferFailed();
      }

      const promoted = await tx.members.updateRole(
        input.workspaceId,
        input.newOwnerUserId,
        WorkspaceRole.OWNER
      );

      if (!promoted || promoted.role !== WorkspaceRole.OWNER) {
        throw WorkspaceError.ownershipTransferFailed();
      }
    });

    return {
      workspace: { id: input.workspaceId },
      ownership: {
        previousOwner: { userId: input.actorId, role: 'admin' },
        newOwner: { userId: input.newOwnerUserId, role: 'owner' }
      }
    };
  }
}
