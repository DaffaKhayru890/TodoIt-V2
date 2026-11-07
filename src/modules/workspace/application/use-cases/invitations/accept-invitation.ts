import type { Clock } from '../../../../../shared/domain/clock';
import type { WorkspaceMember } from '../../../domain/entities/workspace-member';
import { InvitationStatus } from '../../../domain/enums/invitation-status';
import { WorkspaceError } from '../../../domain/errors/workspace-error';
import type { WorkspaceUnitOfWork } from '../../ports/workspace-unit-of-work';
import type { InvitationTokenGenerator } from '../../ports/invitation-token.generator';

export interface AcceptInvitationInput {
  readonly invitationId: string;
  readonly userId: string;
  readonly email: string;
  readonly token: string;
}

export class AcceptInvitation {
  constructor(
    private readonly uow: WorkspaceUnitOfWork,
    private readonly tokens: InvitationTokenGenerator,
    private readonly clock: Clock
  ) {}

  async execute(input: AcceptInvitationInput): Promise<{
    membership: { workspaceId: string; userId: string; role: string; joinedAt: Date };
  }> {
    if (input.token.trim().length === 0) {
      throw WorkspaceError.invitationTokenInvalid();
    }

    const tokenHash = await this.tokens.hash(input.token);
    const normalizedEmail = input.email.trim().toLowerCase();
    const now = this.clock.now();

    const membership = await this.uow.run(async (tx) => {
      const locked = await tx.lockInvitation(input.invitationId);

      if (!locked) {
        throw WorkspaceError.invitationNotFound();
      }

      if (!locked.matchesTokenHash(tokenHash)) {
        throw WorkspaceError.invitationTokenInvalid();
      }

      if (locked.effectiveStatus(now) === InvitationStatus.EXPIRED && locked.status !== InvitationStatus.EXPIRED) {
        await tx.invitations.update(locked.expire(now));
        throw WorkspaceError.invitationExpired();
      }

      if (locked.effectiveStatus(now) !== InvitationStatus.PENDING) {
        throw statusError(locked.effectiveStatus(now));
      }

      if (locked.normalizedEmail !== normalizedEmail) {
        throw WorkspaceError.invitationEmailMismatch();
      }

      const workspace = await tx.lockWorkspace(locked.workspaceId);

      if (!workspace || workspace.archivedAt !== null) {
        throw WorkspaceError.accessDenied();
      }

      const existing = await tx.members.find(locked.workspaceId, input.userId);

      if (existing) {
        await tx.invitations.update(locked.accept(input.userId, now));
        return existing;
      }

      const created: WorkspaceMember = {
        id: crypto.randomUUID(),
        workspaceId: locked.workspaceId,
        userId: input.userId,
        role: locked.role,
        joinedAt: now
      };

      const member = await tx.members.insert(created);
      await tx.invitations.update(locked.accept(input.userId, now));

      return member;
    });

    return {
      membership: {
        workspaceId: membership.workspaceId,
        userId: membership.userId,
        role: membership.role,
        joinedAt: membership.joinedAt
      }
    };
  }
}

function statusError(status: InvitationStatus): WorkspaceError {
  switch (status) {
    case InvitationStatus.ACCEPTED:
      return WorkspaceError.invitationAlreadyAccepted();
    case InvitationStatus.DECLINED:
      return WorkspaceError.invitationAlreadyDeclined();
    case InvitationStatus.REVOKED:
      return WorkspaceError.invitationAlreadyRevoked();
    case InvitationStatus.EXPIRED:
      return WorkspaceError.invitationExpired();
    default:
      return WorkspaceError.invitationTokenInvalid();
  }
}
