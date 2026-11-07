import { WorkspaceError } from '../../domain/errors/workspace-error';
import type { WorkspaceRepository } from '../../domain/repositories/workspace-repository';
import type { WorkspaceDto } from '../dto/workspace.dto';
import type { Clock } from '../../../auth/application/ports/clock';

export interface CreateWorkspaceInput {
  readonly userId: string;
  readonly name: string;
  readonly description?: string | null | undefined;
}

export class CreateWorkspace {
  constructor(
    private readonly workspaces: WorkspaceRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: CreateWorkspaceInput): Promise<WorkspaceDto> {
    const trimmedName = input.name?.trim();

    if (!trimmedName || trimmedName.length < 1 || trimmedName.length > 100) {
      throw WorkspaceError.invalidName('Nama workspace wajib diisi (1-100 karakter).');
    }

    const description = input.description !== undefined && input.description !== null
      ? input.description.trim()
      : null;

    if (description !== null && description.length > 500) {
      throw WorkspaceError.validationError('Deskripsi workspace maksimal 500 karakter.');
    }

    const now = this.clock.now();
    const { workspace, membership } = await this.workspaces.createWorkspaceWithMembership({
      name: trimmedName,
      description,
      createdBy: input.userId,
      now
    });

    return {
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      role: membership.role,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
      archivedAt: workspace.archivedAt
    };
  }
}
