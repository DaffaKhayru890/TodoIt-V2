import type { Clock } from '../../../../../shared/domain/clock';
import { isInvitationStatus, type InvitationStatus } from '../../../domain/enums/invitation-status';
import { WorkspaceRole } from '../../../domain/enums/workspace-role';
import { WorkspaceError } from '../../../domain/errors/workspace-error';
import { isInvitationRole } from '../../../domain/entities/workspace-invitation';
import { WorkspaceAction } from '../../../domain/policies/workspace-authorization.policy';
import { toInvitationDto, type InvitationDto } from '../../dto/invitation.dto';
import type { WorkspaceInvitationRepository } from '../../../domain/repositories/workspace-invitation.repository';
import type { CollaborationCursorCodec } from '../../ports/collaboration-cursor';
import { normalizeCollaborationLimit } from '../../services/collaboration-pagination';
import type { WorkspaceAuthorizationService } from '../../services/workspace-authorization.service';

export interface ListInvitationsInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly limit?: number;
  readonly cursor?: string | null;
  readonly status?: string;
  readonly role?: string;
}

export class ListInvitations {
  constructor(
    private readonly authorization: WorkspaceAuthorizationService,
    private readonly invitations: WorkspaceInvitationRepository,
    private readonly cursorCodec: CollaborationCursorCodec,
    private readonly clock: Clock
  ) {}

  async execute(input: ListInvitationsInput): Promise<{
    items: InvitationDto[];
    pagination: { limit: number; hasMore: boolean; nextCursor: string | null };
  }> {
    const authorized = await this.authorization.authorize({
      workspaceId: input.workspaceId,
      userId: input.userId,
      action: WorkspaceAction.LIST_INVITATIONS
    });
    const limit = normalizeCollaborationLimit(input.limit);
    let status: InvitationStatus | null = null;

    if (input.status !== undefined) {
      if (!isInvitationStatus(input.status)) {
        throw WorkspaceError.validationError('Status undangan tidak valid.');
      }

      status = input.status;
    }

    let role = input.role ?? null;

    if (authorized.role === WorkspaceRole.ADMIN) {
      if (role === WorkspaceRole.ADMIN || role === WorkspaceRole.OWNER) {
        throw WorkspaceError.permissionDenied();
      }

      role = WorkspaceRole.MEMBER;
    } else if (role !== null && !isInvitationRole(role)) {
      throw WorkspaceError.invitationRoleInvalid();
    }

    const now = this.clock.now();
    await this.invitations.expirePending({ workspaceId: input.workspaceId }, now);
    const fingerprint = this.cursorCodec.fingerprint({
      kind: 'workspace-invitations',
      workspaceId: input.workspaceId,
      status,
      role
    });
    const cursor =
      input.cursor === undefined || input.cursor === null
        ? null
        : this.cursorCodec.decodeInvitation(input.cursor, {
            workspaceId: input.workspaceId,
            fingerprint
          });
    const result = await this.invitations.list({
      workspaceId: input.workspaceId,
      ...(status !== null ? { statuses: [status] } : {}),
      ...(role !== null && isInvitationRole(role) ? { role } : {}),
      cursor,
      limit
    });
    const last = result.items[result.items.length - 1];

    return {
      items: result.items.map((item) => toInvitationDto(item, now)),
      pagination: {
        limit,
        hasMore: result.hasMore,
        nextCursor:
          result.hasMore && last
            ? this.cursorCodec.encodeInvitation({
                workspaceId: input.workspaceId,
                createdAt: last.createdAt,
                id: last.id,
                fingerprint
              })
            : null
      }
    };
  }
}
