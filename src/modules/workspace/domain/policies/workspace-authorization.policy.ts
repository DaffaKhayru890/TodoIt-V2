import { WorkspaceRole } from '../enums/workspace-role';

export const WorkspaceAction = {
  VIEW: 'view',
  UPDATE: 'update',
  ARCHIVE: 'archive'
} as const;

export type WorkspaceAction = (typeof WorkspaceAction)[keyof typeof WorkspaceAction];

export class WorkspaceAuthorizationPolicy {
  static canPerform(role: WorkspaceRole | null | undefined, action: WorkspaceAction): boolean {
    if (!role) {
      return false;
    }

    switch (action) {
      case WorkspaceAction.VIEW:
        return role === WorkspaceRole.OWNER || role === WorkspaceRole.ADMIN || role === WorkspaceRole.MEMBER;

      case WorkspaceAction.UPDATE:
      case WorkspaceAction.ARCHIVE:
        return role === WorkspaceRole.OWNER;

      default:
        return false;
    }
  }
}
