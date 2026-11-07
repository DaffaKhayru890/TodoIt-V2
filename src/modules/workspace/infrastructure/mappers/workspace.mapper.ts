import type { Workspace } from '../../domain/entities/workspace';
import type { WorkspaceMember } from '../../domain/entities/workspace-member';
import type { WorkspaceRole } from '../../domain/enums/workspace-role';
import type { workspaceMembers, workspaces } from '../persistence/workspace.schema';

export function toWorkspaceEntity(row: typeof workspaces.$inferSelect): Workspace {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archivedAt: row.archivedAt
  };
}

export function toWorkspaceMemberEntity(row: typeof workspaceMembers.$inferSelect): WorkspaceMember {
  return {
    id: row.id,
    workspaceId: row.workspaceId,
    userId: row.userId,
    role: row.role as WorkspaceRole,
    joinedAt: row.joinedAt
  };
}
