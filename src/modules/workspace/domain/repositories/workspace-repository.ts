import type { Workspace } from '../entities/workspace';
import type { WorkspaceMember } from '../entities/workspace-member';
import type { WorkspaceRole } from '../enums/workspace-role';

export interface CreateWorkspaceCommand {
  readonly name: string;
  readonly description: string | null;
  readonly createdBy: string;
  readonly now: Date;
}

export interface WorkspaceWithRole {
  readonly workspace: Workspace;
  readonly role: WorkspaceRole;
}

export interface ListWorkspacesInput {
  readonly userId: string;
  readonly limit: number;
  readonly offset: number;
}

export interface ListWorkspacesResult {
  readonly items: readonly WorkspaceWithRole[];
  readonly total: number;
}

export interface UpdateWorkspaceCommand {
  readonly id: string;
  readonly name?: string | undefined;
  readonly description?: string | null | undefined;
  readonly now: Date;
}

export interface ArchiveWorkspaceCommand {
  readonly id: string;
  readonly now: Date;
}

export interface WorkspaceRepository {
  /**
   * Membuat workspace dan keanggotaan OWNER untuk creator secara atomik dalam satu transaksi.
   */
  createWorkspaceWithMembership(
    command: CreateWorkspaceCommand
  ): Promise<{ workspace: Workspace; membership: WorkspaceMember }>;

  findById(workspaceId: string): Promise<Workspace | null>;

  findMembership(workspaceId: string, userId: string): Promise<WorkspaceMember | null>;

  findWorkspaceWithRole(workspaceId: string, userId: string): Promise<WorkspaceWithRole | null>;

  listWorkspacesByUser(input: ListWorkspacesInput): Promise<ListWorkspacesResult>;

  updateWorkspace(command: UpdateWorkspaceCommand): Promise<Workspace>;

  archiveWorkspace(command: ArchiveWorkspaceCommand): Promise<Workspace>;
}
