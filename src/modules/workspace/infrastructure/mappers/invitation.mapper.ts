import {
  WorkspaceInvitation,
  type InvitationRole
} from '../../domain/entities/workspace-invitation';
import type { EmailDeliveryStatus } from '../../domain/enums/email-delivery-status';
import type { InvitationStatus } from '../../domain/enums/invitation-status';
import type { workspaceInvitations } from '../persistence/invitation.schema';

export function toInvitationEntity(
  row: typeof workspaceInvitations.$inferSelect
): WorkspaceInvitation {
  return WorkspaceInvitation.restore({
    id: row.id,
    workspaceId: row.workspaceId,
    email: row.email,
    normalizedEmail: row.normalizedEmail,
    role: row.role as InvitationRole,
    tokenHash: row.tokenHash,
    status: row.status as InvitationStatus,
    invitedBy: row.invitedBy,
    acceptedBy: row.acceptedBy,
    expiresAt: row.expiresAt,
    acceptedAt: row.acceptedAt,
    declinedAt: row.declinedAt,
    revokedAt: row.revokedAt,
    deliveryStatus: row.deliveryStatus as EmailDeliveryStatus,
    emailSentAt: row.emailSentAt,
    emailLastAttemptAt: row.emailLastAttemptAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  });
}
