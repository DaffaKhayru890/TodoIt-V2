import { WorkspaceRole, isWorkspaceRole } from '../../../domain/enums/workspace-role';
import { WorkspaceError } from '../../../domain/errors/workspace-error';
import { WorkspaceAction } from '../../../domain/policies/workspace-authorization.policy';
import { toMemberDto, type MemberDto } from '../../dto/member.dto';
import type { WorkspaceUnitOfWork } from '../../ports/workspace-unit-of-work';
import type { WorkspaceUserDirectory } from '../../ports/workspace-user-directory';
import type { WorkspaceAuthorizationService } from '../../services/workspace-authorization.service';

export class ChangeMemberRole {
  constructor(
    private readonly authorization: WorkspaceAuthorizationService,
    private readonly uow: WorkspaceUnitOfWork,
    private readonly users: WorkspaceUserDirectory
  ) {}

  async execute(input: {
    workspaceId: string;
    actorId: string;
    memberUserId: string;
    role: string;
  }): Promise<{ member: MemberDto }> {
    if (!isWorkspaceRole(input.role) || input.role === WorkspaceRole.OWNER) {
      throw WorkspaceError.ownershipTransferInvalid(
        'Role hanya dapat diubah menjadi admin atau member. Owner dipindahkan lewat transfer ownership.'
      );
    }

    const nextRole = input.role;

    await this.authorization.authorize({
      workspaceId: input.workspaceId,
      userId: input.actorId,
      action: WorkspaceAction.CHANGE_MEMBER_ROLE
    });

    if (input.actorId === input.memberUserId) {
      throw WorkspaceError.memberPermissionDenied('Owner tidak dapat mengubah role dirinya sendiri.');
    }

    const member = await this.uow.run(async (tx) => {
      await tx.lockWorkspace(input.workspaceId);
      const current = await tx.members.find(input.workspaceId, input.memberUserId);

      if (!current) {
        throw WorkspaceError.memberNotFound();
      }

      if (current.role === WorkspaceRole.OWNER) {
        throw WorkspaceError.ownershipTransferInvalid('Role owner tidak diubah lewat endpoint ini.');
      }

      const updated = await tx.members.updateRole(input.workspaceId, input.memberUserId, nextRole);

      return updated ?? current;
    });
    const profiles = await this.users.findByIds([member.userId]);
    const profile = profiles[0];

    if (!profile) {
      throw WorkspaceError.memberNotFound();
    }

    return { member: toMemberDto(member, profile) };
  }
}
