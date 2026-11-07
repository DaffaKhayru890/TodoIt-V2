import { WorkspaceError } from '../../domain/errors/workspace-error';
import { WorkspaceAction, WorkspaceAuthorizationPolicy } from '../../domain/policies/workspace-authorization.policy';
import type { WorkspaceRepository } from '../../domain/repositories/workspace-repository';
import type { WorkspaceDto } from '../dto/workspace.dto';

export interface GetWorkspaceInput {
  readonly workspaceId: string;
  readonly userId: string;
}

export class GetWorkspace {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  async execute(input: GetWorkspaceInput): Promise<WorkspaceDto> {
    const found = await this.workspaces.findWorkspaceWithRole(input.workspaceId, input.userId);

    if (!found) {
      throw WorkspaceError.accessDenied();
    }

    const { workspace, role } = found;

    if (workspace.archivedAt !== null) {
      throw WorkspaceError.accessDenied();
    }

    if (!WorkspaceAuthorizationPolicy.canPerform(role, WorkspaceAction.VIEW)) {
      throw WorkspaceError.accessDenied();
    }

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      role,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      archivedAt: workspace.archivedAt
    };
  }
}
