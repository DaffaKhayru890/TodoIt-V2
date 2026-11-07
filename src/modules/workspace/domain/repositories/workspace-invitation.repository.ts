import type { WorkspaceInvitation } from '../entities/workspace-invitation';
import type { InvitationStatus } from '../enums/invitation-status';
import type { InvitationRole } from '../entities/workspace-invitation';

export interface InvitationCursorPosition {
  readonly createdAt: Date;
  readonly id: string;
}

export interface InvitationListQuery {
  readonly workspaceId?: string;
  readonly normalizedEmail?: string;
  readonly statuses?: readonly InvitationStatus[];
  readonly role?: InvitationRole;
  readonly cursor: InvitationCursorPosition | null;
  readonly limit: number;
}

export interface InvitationListResult {
  readonly items: readonly WorkspaceInvitation[];
  readonly hasMore: boolean;
}

export interface WorkspaceInvitationRepository {
  insert(invitation: WorkspaceInvitation): Promise<WorkspaceInvitation>;
  update(invitation: WorkspaceInvitation): Promise<WorkspaceInvitation | null>;
  findById(invitationId: string): Promise<WorkspaceInvitation | null>;
  findPending(workspaceId: string, normalizedEmail: string): Promise<WorkspaceInvitation | null>;
  /** Menandai pending yang sudah lewat expiresAt menjadi expired pada scope yang sama. */
  expirePending(scope: { workspaceId?: string; normalizedEmail?: string }, now: Date): Promise<void>;
  list(query: InvitationListQuery): Promise<InvitationListResult>;
}
