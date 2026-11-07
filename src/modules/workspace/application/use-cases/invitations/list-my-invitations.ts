import type { Clock } from '../../../../../shared/domain/clock';
import { isInvitationStatus, type InvitationStatus } from '../../../domain/enums/invitation-status';
import { WorkspaceError } from '../../../domain/errors/workspace-error';
import type { WorkspaceRepository } from '../../../domain/repositories/workspace-repository';
import type { WorkspaceInvitationRepository } from '../../../domain/repositories/workspace-invitation.repository';
import type { MyInvitationDto } from '../../dto/invitation.dto';
import type { CollaborationCursorCodec } from '../../ports/collaboration-cursor';
import type { WorkspaceUserDirectory } from '../../ports/workspace-user-directory';
import { normalizeCollaborationLimit } from '../../services/collaboration-pagination';

export interface ListMyInvitationsInput {
  readonly userId: string;
  readonly email: string;
  readonly limit?: number;
  readonly cursor?: string | null;
  readonly status?: string;
}

export class ListMyInvitations {
  constructor(
    private readonly invitations: WorkspaceInvitationRepository,
    private readonly workspaces: WorkspaceRepository,
    private readonly users: WorkspaceUserDirectory,
    private readonly cursorCodec: CollaborationCursorCodec,
    private readonly clock: Clock
  ) {}

  async execute(input: ListMyInvitationsInput): Promise<{
    items: MyInvitationDto[];
    pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
  }> {
    const limit = normalizeCollaborationLimit(input.limit);
    const normalizedEmail = input.email.trim().toLowerCase();
    let status: InvitationStatus | null = null;

    if (input.status !== undefined) {
      if (!isInvitationStatus(input.status)) {
        throw WorkspaceError.validationError('Status undangan tidak valid.');
      }

      status = input.status;
    }

    const now = this.clock.now();
    await this.invitations.expirePending({ normalizedEmail }, now);
    const fingerprint = this.cursorCodec.fingerprint({
      kind: 'my-invitations',
      workspaceId: null,
      status,
      role: null
    });
    const cursor =
      input.cursor === undefined || input.cursor === null
        ? null
        : this.cursorCodec.decodeInvitation(input.cursor, { workspaceId: null, fingerprint });
    const result = await this.invitations.list({
      normalizedEmail,
      ...(status !== null ? { statuses: [status] } : {}),
      cursor,
      limit
    });
    const workspaceIds = [...new Set(result.items.map((item) => item.workspaceId))];
    const inviterIds = [...new Set(result.items.map((item) => item.invitedBy))];
    const [workspaceRows, inviters] = await Promise.all([
      Promise.all(workspaceIds.map((id) => this.workspaces.findById(id))),
      this.users.findByIds(inviterIds)
    ]);
    const workspaceNames = new Map(
      workspaceRows.filter((row) => row !== null).map((row) => [row.id, row.name])
    );
    const inviterNames = new Map(inviters.map((user) => [user.id, user.displayName]));
    const last = result.items[result.items.length - 1];

    return {
      items: result.items.map((item) => ({
        id: item.id,
        workspace: {
          id: item.workspaceId,
          name: workspaceNames.get(item.workspaceId) ?? 'Workspace'
        },
        inviter: {
          id: item.invitedBy,
          displayName: inviterNames.get(item.invitedBy) ?? 'Pengundang'
        },
        role: item.role,
        status: item.effectiveStatus(now),
        expiresAt: item.expiresAt
      })),
      pagination: {
        limit,
        hasMore: result.hasMore,
        nextCursor:
          result.hasMore && last
            ? this.cursorCodec.encodeInvitation({
                workspaceId: null,
                createdAt: last.createdAt,
                id: last.id,
                fingerprint
              })
            : null
      }
    };
  }
}
