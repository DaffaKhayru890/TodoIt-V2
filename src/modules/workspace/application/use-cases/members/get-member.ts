import { WorkspaceError } from '../../../domain/errors/workspace-error';
import { WorkspaceAction } from '../../../domain/policies/workspace-authorization.policy';
import type { WorkspaceMemberRepository } from '../../../domain/repositories/workspace-member.repository';
import { toMemberDto, type MemberDto } from '../../dto/member.dto';
import type { WorkspaceUserDirectory } from '../../ports/workspace-user-directory';
import type { WorkspaceAuthorizationService } from '../../services/workspace-authorization.service';

export class GetMember {
  constructor(
    private readonly authorization: WorkspaceAuthorizationService,
    private readonly members: WorkspaceMemberRepository,
    private readonly users: WorkspaceUserDirectory
  ) {}

  async execute(input: {
    workspaceId: string;
    actorId: string;
    memberUserId: string;
  }): Promise<{ member: MemberDto }> {
    await this.authorization.authorize({
      workspaceId: input.workspaceId,
      userId: input.actorId,
      action: WorkspaceAction.VIEW_MEMBERS
    });
    const member = await this.members.find(input.workspaceId, input.memberUserId);

    if (!member) {
      throw WorkspaceError.memberNotFound();
    }

    const profiles = await this.users.findByIds([member.userId]);
    const profile = profiles[0];

    if (!profile) {
      throw WorkspaceError.memberNotFound();
    }

    return { member: toMemberDto(member, profile) };
  }
}
