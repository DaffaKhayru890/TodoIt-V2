import { and, desc, eq, inArray, lt, lte, or, type SQL } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../../shared/infrastructure/database/client';
import { isUniqueViolation, uniqueConstraintName } from '../../../../shared/infrastructure/database/errors';
import type { WorkspaceInvitation } from '../../domain/entities/workspace-invitation';
import { InvitationStatus } from '../../domain/enums/invitation-status';
import { WorkspaceError } from '../../domain/errors/workspace-error';
import type {
  InvitationListQuery,
  InvitationListResult,
  WorkspaceInvitationRepository
} from '../../domain/repositories/workspace-invitation.repository';
import { toInvitationEntity } from '../mappers/invitation.mapper';
import { workspaceInvitations } from './invitation.schema';

function snapshotValues(invitation: WorkspaceInvitation) {
  const snapshot = invitation.toSnapshot();

  return {
    id: snapshot.id,
    workspaceId: snapshot.workspaceId,
    email: snapshot.email,
    normalizedEmail: snapshot.normalizedEmail,
    role: snapshot.role,
    tokenHash: snapshot.tokenHash,
    status: snapshot.status,
    invitedBy: snapshot.invitedBy,
    acceptedBy: snapshot.acceptedBy,
    expiresAt: snapshot.expiresAt,
    acceptedAt: snapshot.acceptedAt,
    declinedAt: snapshot.declinedAt,
    revokedAt: snapshot.revokedAt,
    deliveryStatus: snapshot.deliveryStatus,
    emailSentAt: snapshot.emailSentAt,
    emailLastAttemptAt: snapshot.emailLastAttemptAt,
    createdAt: snapshot.createdAt,
    updatedAt: snapshot.updatedAt
  };
}

export class DrizzleWorkspaceInvitationRepository implements WorkspaceInvitationRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async insert(invitation: WorkspaceInvitation): Promise<WorkspaceInvitation> {
    try {
      const rows = await this.database
        .insert(workspaceInvitations)
        .values(snapshotValues(invitation))
        .returning();
      const row = rows[0];

      if (!row) {
        throw WorkspaceError.invitationAlreadyPending();
      }

      return toInvitationEntity(row);
    } catch (error) {
      if (isUniqueViolation(error)) {
        const constraint = uniqueConstraintName(error);

        if (constraint === 'workspace_invitations_pending_email_uidx') {
          throw WorkspaceError.invitationAlreadyPending();
        }

        throw WorkspaceError.validationError('Token undangan tidak dapat disimpan.');
      }

      throw error;
    }
  }

  async update(invitation: WorkspaceInvitation): Promise<WorkspaceInvitation | null> {
    try {
      const values = snapshotValues(invitation);
      const rows = await this.database
        .update(workspaceInvitations)
        .set({
          tokenHash: values.tokenHash,
          status: values.status,
          acceptedBy: values.acceptedBy,
          expiresAt: values.expiresAt,
          acceptedAt: values.acceptedAt,
          declinedAt: values.declinedAt,
          revokedAt: values.revokedAt,
          deliveryStatus: values.deliveryStatus,
          emailSentAt: values.emailSentAt,
          emailLastAttemptAt: values.emailLastAttemptAt,
          updatedAt: values.updatedAt
        })
        .where(eq(workspaceInvitations.id, invitation.id))
        .returning();
      const row = rows[0];

      return row ? toInvitationEntity(row) : null;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw WorkspaceError.invitationAlreadyPending();
      }

      throw error;
    }
  }

  async findById(invitationId: string): Promise<WorkspaceInvitation | null> {
    const rows = await this.database
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.id, invitationId))
      .limit(1);
    const row = rows[0];

    return row ? toInvitationEntity(row) : null;
  }

  async findPending(workspaceId: string, normalizedEmail: string): Promise<WorkspaceInvitation | null> {
    const rows = await this.database
      .select()
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, workspaceId),
          eq(workspaceInvitations.normalizedEmail, normalizedEmail),
          eq(workspaceInvitations.status, InvitationStatus.PENDING)
        )
      )
      .limit(1);
    const row = rows[0];

    return row ? toInvitationEntity(row) : null;
  }

  async expirePending(
    scope: { workspaceId?: string; normalizedEmail?: string },
    now: Date
  ): Promise<void> {
    const conditions: SQL[] = [
      eq(workspaceInvitations.status, InvitationStatus.PENDING),
      lte(workspaceInvitations.expiresAt, now)
    ];

    if (scope.workspaceId !== undefined) {
      conditions.push(eq(workspaceInvitations.workspaceId, scope.workspaceId));
    }

    if (scope.normalizedEmail !== undefined) {
      conditions.push(eq(workspaceInvitations.normalizedEmail, scope.normalizedEmail));
    }

    await this.database
      .update(workspaceInvitations)
      .set({ status: InvitationStatus.EXPIRED, updatedAt: now })
      .where(and(...conditions));
  }

  async list(query: InvitationListQuery): Promise<InvitationListResult> {
    const conditions: SQL[] = [];

    if (query.workspaceId !== undefined) {
      conditions.push(eq(workspaceInvitations.workspaceId, query.workspaceId));
    }

    if (query.normalizedEmail !== undefined) {
      conditions.push(eq(workspaceInvitations.normalizedEmail, query.normalizedEmail));
    }

    if (query.statuses !== undefined && query.statuses.length > 0) {
      conditions.push(inArray(workspaceInvitations.status, [...query.statuses]));
    }

    if (query.role !== undefined) {
      conditions.push(eq(workspaceInvitations.role, query.role));
    }

    if (query.cursor !== null) {
      const cursorCondition = or(
        lt(workspaceInvitations.createdAt, query.cursor.createdAt),
        and(
          eq(workspaceInvitations.createdAt, query.cursor.createdAt),
          lt(workspaceInvitations.id, query.cursor.id)
        )
      );

      if (cursorCondition) {
        conditions.push(cursorCondition);
      }
    }

    const rows = await this.database
      .select()
      .from(workspaceInvitations)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(workspaceInvitations.createdAt), desc(workspaceInvitations.id))
      .limit(query.limit + 1);
    const hasMore = rows.length > query.limit;

    return {
      items: (hasMore ? rows.slice(0, query.limit) : rows).map(toInvitationEntity),
      hasMore
    };
  }
}
