export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly role: WorkspaceRole;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
  readonly mark: string;
}

export interface WorkspaceListItem {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly role: WorkspaceRole;
  readonly createdAt: Date;
  readonly mark: string;
}

export interface WorkspacePagination {
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
}

export interface WorkspaceListResult {
  readonly items: readonly WorkspaceListItem[];
  readonly pagination: WorkspacePagination;
}

export interface CreateWorkspaceInput {
  readonly name: string;
  readonly description?: string | null;
}

export interface UpdateWorkspaceInput {
  readonly name?: string;
  readonly description?: string | null;
}

export interface ArchiveWorkspaceResult {
  readonly id: string;
  readonly archivedAt: Date;
}
