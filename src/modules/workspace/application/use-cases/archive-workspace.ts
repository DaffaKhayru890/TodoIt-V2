import { WorkspaceError } from '../../domain/errors/workspace-error';
import { WorkspaceAction, WorkspaceAuthorizationPolicy } from '../../domain/policies/workspace-authorization.policy';
import type { WorkspaceRepository } from '../../domain/repositories/workspace-repository';
import type { Clock } from '../../../auth/application/ports/clock';

export interface ArchiveWorkspaceInput {
  readonly workspaceId: string;
  readonly userId: string;
}

export interface ArchiveWorkspaceResult {
  readonly workspace: {
    readonly id: string;
    readonly archivedAt: Date;
  };
}

export class ArchiveWorkspace {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: ArchiveWorkspaceInput): Promise<ArchiveWorkspaceResult> {
    const found = await this.workspaces.findWorkspaceWithRole(input.workspaceId, input.userId);

    if (!found) {
      throw WorkspaceError.accessDenied();
    }

    const { workspace, role } = found;

    if (!WorkspaceAuthorizationPolicy.canPerform(role, WorkspaceAction.ARCHIVE)) {
      throw WorkspaceError.permissionDenied();
    }

    // Operasi idempoten: bila sudah diarsipkan, kembalikan archivedAt yang sudah ada
    if (workspace.archivedAt !== null) {
      return {
        workspace: {
          id: workspace.id,
          archivedAt: workspace.archivedAt
        }
      };
    }

    const now = this.clock.now();
    const archived = await this.workspaces.archiveWorkspace({
      id: workspace.id,
      now
    });

    return {
      workspace: {
        id: archived.id,
        archivedAt: archived.archivedAt ?? now
      }
    };
  }
}
