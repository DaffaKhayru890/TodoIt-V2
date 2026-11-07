import type { Workspace } from '../../domain/entities/workspace';
import type { WorkspaceMember } from '../../domain/entities/workspace-member';
import type { WorkspaceRole } from '../../domain/enums/workspace-role';
import { WorkspaceError } from '../../domain/errors/workspace-error';
import {
  WorkspaceAuthorizationPolicy,
  type WorkspaceAction
} from '../../domain/policies/workspace-authorization.policy';
import type { WorkspaceRepository } from '../../domain/repositories/workspace-repository';

export interface AuthorizedWorkspace {
  readonly workspace: Workspace;
  readonly membership: WorkspaceMember;
  readonly role: WorkspaceRole;
}

export class WorkspaceAuthorizationService {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  async authorize(input: {
    workspaceId: string;
    userId: string;
    action: WorkspaceAction;
  }): Promise<AuthorizedWorkspace> {
    const found = await this.workspaces.findWorkspaceWithRole(input.workspaceId, input.userId);

    if (!found || found.workspace.archivedAt !== null) {
      throw WorkspaceError.accessDenied();
    }

    if (!WorkspaceAuthorizationPolicy.canPerform(found.role, input.action)) {
      throw WorkspaceError.permissionDenied();
    }

    const membership = await this.workspaces.findMembership(input.workspaceId, input.userId);

    if (!membership) {
      throw WorkspaceError.accessDenied();
    }

    return { workspace: found.workspace, membership, role: found.role };
  }
}
