import type { WorkspaceRole } from '../enums/workspace-role';

export interface WorkspaceMember {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: WorkspaceRole;
  readonly joinedAt: Date;
}
