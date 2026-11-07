import { createHash } from 'node:crypto';
import type { WorkspaceInvitation } from '../../src/modules/workspace/domain/entities/workspace-invitation';
import { InvitationStatus } from '../../src/modules/workspace/domain/enums/invitation-status';
import { WorkspaceError } from '../../src/modules/workspace/domain/errors/workspace-error';
import type {
  InvitationListQuery,
  InvitationListResult,
  WorkspaceInvitationRepository
} from '../../src/modules/workspace/domain/repositories/workspace-invitation.repository';
import type { WorkspaceMember } from '../../src/modules/workspace/domain/entities/workspace-member';
import type { WorkspaceRole } from '../../src/modules/workspace/domain/enums/workspace-role';
import type {
  MemberListQuery,
  MemberListResult,
  WorkspaceMemberRepository
} from '../../src/modules/workspace/domain/repositories/workspace-member.repository';
import type { InvitationTokenGenerator } from '../../src/modules/workspace/application/ports/invitation-token.generator';
import type { InvitationEmailMessage, InvitationEmailSender } from '../../src/modules/workspace/application/ports/invitation-email.sender';
import type { WorkspaceTransactionContext, WorkspaceUnitOfWork } from '../../src/modules/workspace/application/ports/workspace-unit-of-work';
import type { WorkspaceUserDirectory, WorkspaceUserProfile } from '../../src/modules/workspace/application/ports/workspace-user-directory';
import type { InMemoryWorkspaceRepository } from './in-memory-workspace-repository';

export class InMemoryInvitationRepository implements WorkspaceInvitationRepository {
  readonly items: WorkspaceInvitation[] = [];

  async insert(invitation: WorkspaceInvitation): Promise<WorkspaceInvitation> {
    const duplicate = this.items.some(
      (item) =>
        item.workspaceId === invitation.workspaceId &&
        item.normalizedEmail === invitation.normalizedEmail &&
        item.status === InvitationStatus.PENDING
    );

    if (duplicate) {
      throw WorkspaceError.invitationAlreadyPending();
    }

    this.items.push(invitation);
    return invitation;
  }

  async update(invitation: WorkspaceInvitation): Promise<WorkspaceInvitation | null> {
    const index = this.items.findIndex((item) => item.id === invitation.id);

    if (index < 0) {
      return null;
    }

    this.items[index] = invitation;
    return invitation;
  }

  async findById(invitationId: string): Promise<WorkspaceInvitation | null> {
    return this.items.find((item) => item.id === invitationId) ?? null;
  }

  async findPending(workspaceId: string, normalizedEmail: string): Promise<WorkspaceInvitation | null> {
    return (
      this.items.find(
        (item) =>
          item.workspaceId === workspaceId &&
          item.normalizedEmail === normalizedEmail &&
          item.status === InvitationStatus.PENDING
      ) ?? null
    );
  }

  async expirePending(
    scope: { workspaceId?: string; normalizedEmail?: string },
    now: Date
  ): Promise<void> {
    for (let index = 0; index < this.items.length; index += 1) {
      const item = this.items[index];

      if (!item) {
        continue;
      }

      if (scope.workspaceId && item.workspaceId !== scope.workspaceId) {
        continue;
      }

      if (scope.normalizedEmail && item.normalizedEmail !== scope.normalizedEmail) {
        continue;
      }

      if (item.effectiveStatus(now) === InvitationStatus.EXPIRED && item.status === InvitationStatus.PENDING) {
        this.items[index] = item.expire(now);
      }
    }
  }

  async list(query: InvitationListQuery): Promise<InvitationListResult> {
    const filtered = this.items
      .filter((item) => (query.workspaceId ? item.workspaceId === query.workspaceId : true))
      .filter((item) => (query.normalizedEmail ? item.normalizedEmail === query.normalizedEmail : true))
      .filter((item) => (query.statuses ? query.statuses.includes(item.status) : true))
      .filter((item) => (query.role ? item.role === query.role : true))
      .filter((item) => {
        if (!query.cursor) {
          return true;
        }

        const created = item.createdAt.getTime();
        const cursorCreated = query.cursor.createdAt.getTime();

        return created < cursorCreated || (created === cursorCreated && item.id < query.cursor.id);
      })
      .sort((left, right) => {
        const byTime = right.createdAt.getTime() - left.createdAt.getTime();

        return byTime === 0 ? right.id.localeCompare(left.id) : byTime;
      });
    const page = filtered.slice(0, query.limit + 1);

    return {
      items: page.slice(0, query.limit),
      hasMore: page.length > query.limit
    };
  }
}

export class InMemoryMemberRepository implements WorkspaceMemberRepository {
  constructor(private readonly workspaces: InMemoryWorkspaceRepository) {}

  async find(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    return this.workspaces.findMembership(workspaceId, userId);
  }

  async insert(member: WorkspaceMember): Promise<WorkspaceMember> {
    const existing = await this.find(member.workspaceId, member.userId);

    if (existing) {
      throw WorkspaceError.memberAlreadyExists();
    }

    const owners = this.workspaces.members.filter(
      (item) => item.workspaceId === member.workspaceId && item.role === 'owner'
    );

    if (member.role === 'owner' && owners.length > 0) {
      throw WorkspaceError.ownershipTransferFailed();
    }

    this.workspaces.members.push(member);
    return member;
  }

  async updateRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole
  ): Promise<WorkspaceMember | null> {
    const member = this.workspaces.members.find(
      (item) => item.workspaceId === workspaceId && item.userId === userId
    );

    if (!member) {
      return null;
    }

    if (role === 'owner') {
      const otherOwner = this.workspaces.members.find(
        (item) => item.workspaceId === workspaceId && item.role === 'owner' && item.userId !== userId
      );

      if (otherOwner) {
        throw WorkspaceError.ownershipTransferFailed();
      }
    }

    const next = { ...member, role };
    const index = this.workspaces.members.indexOf(member);
    this.workspaces.members[index] = next;
    return next;
  }

  async delete(workspaceId: string, userId: string): Promise<boolean> {
    const before = this.workspaces.members.length;
    this.workspaces.members = this.workspaces.members.filter(
      (item) => !(item.workspaceId === workspaceId && item.userId === userId)
    );

    return this.workspaces.members.length !== before;
  }

  async list(query: MemberListQuery): Promise<MemberListResult> {
    const filtered = this.workspaces.members
      .filter((item) => item.workspaceId === query.workspaceId)
      .filter((item) => (query.role ? item.role === query.role : true))
      .filter((item) => {
        if (!query.cursor) {
          return true;
        }

        const joined = item.joinedAt.getTime();
        const cursorJoined = query.cursor.joinedAt.getTime();

        return joined < cursorJoined || (joined === cursorJoined && item.userId < query.cursor.userId);
      })
      .sort((left, right) => {
        const byTime = right.joinedAt.getTime() - left.joinedAt.getTime();

        return byTime === 0 ? right.userId.localeCompare(left.userId) : byTime;
      });
    const page = filtered.slice(0, query.limit + 1);

    return { items: page.slice(0, query.limit), hasMore: page.length > query.limit };
  }
}

export class InMemoryWorkspaceUnitOfWork implements WorkspaceUnitOfWork {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly workspaces: InMemoryWorkspaceRepository,
    private readonly invitations: WorkspaceInvitationRepository,
    private readonly members: WorkspaceMemberRepository
  ) {}

  async run<T>(work: (context: WorkspaceTransactionContext) => Promise<T>): Promise<T> {
    const next = this.chain.then(() =>
      work({
        invitations: this.invitations,
        members: this.members,
        lockWorkspace: (workspaceId) => this.workspaces.findById(workspaceId),
        lockInvitation: (invitationId) => this.invitations.findById(invitationId)
      })
    );
    this.chain = next.then(
      () => undefined,
      () => undefined
    );

    return await next;
  }
}

export class SequenceInvitationTokenGenerator implements InvitationTokenGenerator {
  private sequence = 0;
  readonly issued: string[] = [];

  async generate(): Promise<{ token: string; tokenHash: string }> {
    this.sequence += 1;
    const token = `raw-token-${this.sequence.toString().padStart(4, '0')}-${'a'.repeat(40)}`;
    this.issued.push(token);

    return { token, tokenHash: await this.hash(token) };
  }

  async hash(token: string): Promise<string> {
    return createHash('sha256').update(token, 'utf8').digest('hex');
  }
}

export class FakeInvitationEmailSender implements InvitationEmailSender {
  readonly sent: InvitationEmailMessage[] = [];
  fail = false;

  async sendWorkspaceInvitation(input: InvitationEmailMessage): Promise<void> {
    if (this.fail) {
      throw new Error('smtp mailbox unavailable');
    }

    this.sent.push(input);
  }
}

export class InMemoryWorkspaceUserDirectory implements WorkspaceUserDirectory {
  constructor(private readonly users: WorkspaceUserProfile[]) {}

  async findByNormalizedEmail(normalizedEmail: string): Promise<WorkspaceUserProfile | null> {
    return this.users.find((user) => user.email === normalizedEmail) ?? null;
  }

  async findByIds(userIds: readonly string[]): Promise<readonly WorkspaceUserProfile[]> {
    return this.users.filter((user) => userIds.includes(user.id));
  }
}
