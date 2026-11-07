import { isWorkspaceRole, type WorkspaceRole } from '../../../domain/enums/workspace-role';
import { WorkspaceError } from '../../../domain/errors/workspace-error';
import { WorkspaceAction } from '../../../domain/policies/workspace-authorization.policy';
import type { WorkspaceMemberRepository } from '../../../domain/repositories/workspace-member.repository';
import { toMemberDto, type MemberDto } from '../../dto/member.dto';
import type { CollaborationCursorCodec } from '../../ports/collaboration-cursor';
import type { WorkspaceUserDirectory } from '../../ports/workspace-user-directory';
import { normalizeCollaborationLimit } from '../../services/collaboration-pagination';
import type { WorkspaceAuthorizationService } from '../../services/workspace-authorization.service';

export interface ListMembersInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly limit?: number;
  readonly cursor?: string | null;
  readonly role?: string;
}

export class ListMembers {
  constructor(
    private readonly authorization: WorkspaceAuthorizationService,
    private readonly members: WorkspaceMemberRepository,
    private readonly users: WorkspaceUserDirectory,
    private readonly cursorCodec: CollaborationCursorCodec
  ) {}

  async execute(input: ListMembersInput): Promise<{
    items: MemberDto[];
    pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
  }> {
    await this.authorization.authorize({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: WorkspaceAction.VIEW_MEMBERS
    });
    const limit = normalizeCollaborationLimit(input.limit);
    let role: WorkspaceRole | null = null;

    if (input.role !== undefined) {
      if (!isWorkspaceRole(input.role)) {
        throw WorkspaceError.validationError('Role anggota tidak valid.');
      }

      role = input.role;
    }

    const fingerprint = this.cursorCodec.fingerprint({
      kind: 'members',
      workspaceId: input.workspaceId,
      status: null,
      role
    });
    const cursor =
      input.cursor === undefined || input.cursor === null
        ? null
        : this.cursorCodec.decodeMember(input.cursor, {
            workspaceId: input.workspaceId,
            fingerprint
          });
    const result = await this.members.list({
      workspaceId: input.workspaceId,
      ...(role !== null ? { role } : {}),
      cursor,
      limit
    });
    const profiles = await this.users.findByIds(result.items.map((item) => item.userId));
    const byId = new Map(profiles.map((profile) => [profile.id, profile]));
    const last = result.items[result.items.length - 1];

    return {
      items: result.items.flatMap((member) => {
        const profile = byId.get(member.userId);

        return profile ? [toMemberDto(member, profile)] : [];
      }),
      pagination: {
        limit,
        hasMore: result.hasMore,
        nextCursor:
          result.hasMore && last
            ? this.cursorCodec.encodeMember({
                workspaceId: input.workspaceId,
                joinedAt: last.joinedAt,
                userId: last.userId,
                fingerprint
              })
            : null
      }
    };
  }
}
