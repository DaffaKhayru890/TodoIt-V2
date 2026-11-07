import { WorkspaceError } from '../../domain/errors/workspace-error';
import { WorkspaceAction, WorkspaceAuthorizationPolicy } from '../../domain/policies/workspace-authorization.policy';
import type { WorkspaceRepository } from '../../domain/repositories/workspace-repository';
import type { WorkspaceDto } from '../dto/workspace.dto';
import type { Clock } from '../../../auth/application/ports/clock';

export interface UpdateWorkspaceInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly name?: string | undefined;
  readonly description?: string | null | undefined;
}

export class UpdateWorkspace {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: UpdateWorkspaceInput): Promise<WorkspaceDto> {
    if (input.name === undefined && input.description === undefined) {
      throw WorkspaceError.validationError('Minimal satu field (name atau description) harus diubah.');
    }

    let trimmedName: string | undefined;
    if (input.name !== undefined) {
      trimmedName = input.name.trim();
      if (trimmedName.length < 1 || trimmedName.length > 100) {
        throw WorkspaceError.invalidName('Nama workspace wajib diisi (1-100 karakter).');
      }
    }

    let sanitizedDescription: string | null | undefined;
    if (input.description !== undefined) {
      if (input.description === null) {
        sanitizedDescription = null;
      } else {
        const desc = input.description.trim();
        if (desc.length > 500) {
          throw WorkspaceError.validationError('Deskripsi workspace maksimal 500 karakter.');
        }
        sanitizedDescription = desc;
      }
    }

    const found = await this.workspaces.findWorkspaceWithRole(input.workspaceId, input.userId);

    if (!found) {
      throw WorkspaceError.accessDenied();
    }

    const { workspace, role } = found;

    if (workspace.archivedAt !== null) {
      throw WorkspaceError.accessDenied();
    }

    if (!WorkspaceAuthorizationPolicy.canPerform(role, WorkspaceAction.UPDATE)) {
      throw WorkspaceError.permissionDenied();
    }

    const now = this.clock.now();
    const updated = await this.workspaces.updateWorkspace({
      id: workspace.id,
      name: trimmedName,
      description: sanitizedDescription,
      now
    });

    return {
      id: updated.id,
      name: updated.name,
      description: updated.description,
      role,
      createdAt: updated.createdAt,
      updatedAt: updated.updatedAt,
      archivedAt: updated.archivedAt
    };
  }
}
