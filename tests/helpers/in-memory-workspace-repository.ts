import type { Workspace } from '../../src/modules/workspace/domain/entities/workspace';
import type { WorkspaceMember } from '../../src/modules/workspace/domain/entities/workspace-member';
import { WorkspaceRole } from '../../src/modules/workspace/domain/enums/workspace-role';
import type {
  ArchiveWorkspaceCommand,
  CreateWorkspaceCommand,
  ListWorkspacesInput,
  ListWorkspacesResult,
  UpdateWorkspaceCommand,
  WorkspaceRepository,
  WorkspaceWithRole
} from '../../src/modules/workspace/domain/repositories/workspace-repository';

export class InMemoryWorkspaceRepository implements WorkspaceRepository {
  workspaces: Workspace[] = [];
  members: WorkspaceMember[] = [];
  failOnMembershipInsert = false;

  async createWorkspaceWithMembership(
    command: CreateWorkspaceCommand
  ): Promise<{ workspace: Workspace; membership: WorkspaceMember }> {
    const workspaceId = crypto.randomUUID();
    const memberId = crypto.randomUUID();

    const workspace: Workspace = {
      id: workspaceId,
      name: command.name,
      description: command.description,
      createdBy: command.createdBy,
      createdAt: command.now,
      updatedAt: command.now,
      archivedAt: null
    };

    if (this.failOnMembershipInsert) {
      // Mensimulasikan rollback: workspace tidak disimpan
      throw new Error('Database transaction failed while inserting member');
    }

    const membership: WorkspaceMember = {
      id: memberId,
      workspaceId,
      userId: command.createdBy,
      role: WorkspaceRole.OWNER,
      joinedAt: command.now
    };

    this.workspaces.push(workspace);
    this.members.push(membership);

    return { workspace, membership };
  }

  async findById(workspaceId: string): Promise<Workspace | null> {
    const workspace = this.workspaces.find((w) => w.id === workspaceId);
    return workspace ?? null;
  }

  async findMembership(workspaceId: string, userId: string): Promise<WorkspaceMember | null> {
    const member = this.members.find((m) => m.workspaceId === workspaceId && m.userId === userId);
    return member ?? null;
  }

  async findWorkspaceWithRole(workspaceId: string, userId: string): Promise<WorkspaceWithRole | null> {
    const workspace = this.workspaces.find((w) => w.id === workspaceId);
    if (!workspace) {
      return null;
    }

    const member = this.members.find((m) => m.workspaceId === workspaceId && m.userId === userId);
    if (!member) {
      return null;
    }

    return {
      workspace,
      role: member.role
    };
  }

  async listWorkspacesByUser(input: ListWorkspacesInput): Promise<ListWorkspacesResult> {
    const userMembers = this.members.filter((m) => m.userId === input.userId);
    const activeItems: WorkspaceWithRole[] = [];

    for (const member of userMembers) {
      const workspace = this.workspaces.find((w) => w.id === member.workspaceId && w.archivedAt === null);
      if (workspace) {
        activeItems.push({
          workspace,
          role: member.role
        });
      }
    }

    // Sort createdAt DESC
    activeItems.sort((a, b) => b.workspace.createdAt.getTime() - a.workspace.createdAt.getTime());

    const total = activeItems.length;
    const paginated = activeItems.slice(input.offset, input.offset + input.limit);

    return {
      items: paginated,
      total
    };
  }

  async updateWorkspace(command: UpdateWorkspaceCommand): Promise<Workspace> {
    const workspace = this.workspaces.find((w) => w.id === command.id);
    if (!workspace) {
      throw new Error(`Workspace ${command.id} not found`);
    }

    const updated: Workspace = {
      ...workspace,
      name: command.name !== undefined ? command.name : workspace.name,
      description: command.description !== undefined ? command.description : workspace.description,
      updatedAt: command.now
    };

    const index = this.workspaces.indexOf(workspace);
    this.workspaces[index] = updated;

    return updated;
  }

  async archiveWorkspace(command: ArchiveWorkspaceCommand): Promise<Workspace> {
    const workspace = this.workspaces.find((w) => w.id === command.id);
    if (!workspace) {
      throw new Error(`Workspace ${command.id} not found`);
    }

    const archived: Workspace = {
      ...workspace,
      archivedAt: workspace.archivedAt ?? command.now,
      updatedAt: command.now
    };

    const index = this.workspaces.indexOf(workspace);
    this.workspaces[index] = archived;

    return archived;
  }
}
