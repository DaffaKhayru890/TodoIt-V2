import type { WorkspaceRepository } from '../../domain/repositories/workspace-repository';
import type { WorkspaceListResponseDto } from '../dto/workspace.dto';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;
const DEFAULT_OFFSET = 0;

export interface ListWorkspacesInput {
  readonly userId: string;
  readonly limit?: number | undefined;
  readonly offset?: number | undefined;
}

export class ListWorkspaces {
  constructor(private readonly workspaces: WorkspaceRepository) {}

  async execute(input: ListWorkspacesInput): Promise<WorkspaceListResponseDto> {
    const rawLimit = typeof input.limit === 'number' && !isNaN(input.limit) ? input.limit : DEFAULT_LIMIT;
    const limit = Math.max(1, Math.min(rawLimit, MAX_LIMIT));

    const rawOffset = typeof input.offset === 'number' && !isNaN(input.offset) ? input.offset : DEFAULT_OFFSET;
    const offset = Math.max(0, rawOffset);

    const result = await this.workspaces.listWorkspacesByUser({
      userId: input.userId,
      limit,
      offset
    });

    const items = result.items.map(({ workspace, role }) => ({
      id: workspace.id,
      name: workspace.name,
      description: workspace.description,
      role,
      createdAt: workspace.createdAt
    }));

    return {
      items,
      pagination: {
        limit,
        offset,
        total: result.total
      }
    };
  }
}
