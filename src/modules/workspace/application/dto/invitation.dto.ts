import type { WorkspaceInvitation } from '../../domain/entities/workspace-invitation';
import type { InvitationStatus } from '../../domain/enums/invitation-status';

export interface InvitationDto {
  readonly id: string;
  readonly workspaceId: string;
  readonly email: string;
  readonly role: string;
  readonly status: InvitationStatus;
  readonly deliveryStatus: string;
  readonly expiresAt: Date;
  readonly createdAt: Date;
}

export interface MyInvitationDto {
  readonly id: string;
  readonly workspace: { readonly id: string; readonly name: string };
  readonly inviter: { readonly id: string; readonly displayName: string };
  readonly role: string;
  readonly status: InvitationStatus;
  readonly expiresAt: Date;
}

export function toInvitationDto(invitation: WorkspaceInvitation, now: Date): InvitationDto {
  return {
    id: invitation.id,
    workspaceId: invitation.workspaceId,
    email: invitation.email,
    role: invitation.role,
    status: invitation.effectiveStatus(now),
    deliveryStatus: invitation.deliveryStatus,
    expiresAt: invitation.expiresAt,
    createdAt: invitation.createdAt
  };
}
