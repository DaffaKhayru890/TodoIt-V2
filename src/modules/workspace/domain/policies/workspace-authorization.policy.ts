import { WorkspaceRole } from '../enums/workspace-role';

export const WorkspaceAction = {
  VIEW: 'view',
  UPDATE: 'update',
  ARCHIVE: 'archive',
  VIEW_MEMBERS: 'view_members',
  INVITE_MEMBER: 'invite_member',
  INVITE_ADMIN: 'invite_admin',
  LIST_INVITATIONS: 'list_invitations',
  RESEND_INVITATION: 'resend_invitation',
  REVOKE_INVITATION: 'revoke_invitation',
  CHANGE_MEMBER_ROLE: 'change_member_role',
  REMOVE_MEMBER: 'remove_member',
  LEAVE_WORKSPACE: 'leave_workspace',
  TRANSFER_OWNERSHIP: 'transfer_ownership'
} as const;

export type WorkspaceAction = (typeof WorkspaceAction)[keyof typeof WorkspaceAction];

/**
 * Policy murni. Pemeriksaan target (undangan milik sendiri, role target
 * penghapusan) tetap di use case karena membutuhkan data resource, bukan hanya
 * role aktor.
 */
export class WorkspaceAuthorizationPolicy {
  static canPerform(role: WorkspaceRole | null | undefined, action: WorkspaceAction): boolean {
    if (!role) {
      return false;
    }

    const isMember =
      role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN || role === WorkspaceRole.MEMBER;
    const isOwner = role === WorkspaceRole.OWNER;
    const isManager = role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN;

    switch (action) {
      case WorkspaceAction.VIEW:
      case WorkspaceAction.VIEW_MEMBERS:
      case WorkspaceAction.LEAVE_WORKSPACE:
        return isMember;

      case WorkspaceAction.UPDATE:
      case WorkspaceAction.ARCHIVE:
      case WorkspaceAction.INVITE_ADMIN:
      case WorkspaceAction.CHANGE_MEMBER_ROLE:
      case WorkspaceAction.TRANSFER_OWNERSHIP:
        return isOwner;

      case WorkspaceAction.INVITE_MEMBER:
      case WorkspaceAction.LIST_INVITATIONS:
      case WorkspaceAction.RESEND_INVITATION:
      case WorkspaceAction.REVOKE_INVITATION:
      case WorkspaceAction.REMOVE_MEMBER:
        return isManager;

      default:
        return false;
    }
  }
}
