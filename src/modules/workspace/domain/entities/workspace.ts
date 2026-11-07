export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
}

export function isWorkspaceArchived(workspace: Workspace): boolean {
  return workspace.archivedAt !== null;
}
