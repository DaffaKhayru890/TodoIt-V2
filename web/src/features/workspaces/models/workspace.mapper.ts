import type {
  ArchiveWorkspaceResponseDto,
  CreateWorkspaceRequestDto,
  ListWorkspacesResponseDto,
  UpdateWorkspaceRequestDto,
  WorkspaceItemDto,
  WorkspaceListItemDto
} from './workspace.dto';
import type {
  ArchiveWorkspaceResult,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  Workspace,
  WorkspaceListItem,
  WorkspaceListResult,
  WorkspaceRole
} from './workspace.model';

export function deriveWorkspaceMark(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) {
    return 'W';
  }
  return trimmed.charAt(0).toUpperCase();
}

export function parseWorkspaceRole(role: string): WorkspaceRole {
  if (role === 'owner' || role === 'admin' || role === 'member') {
    return role;
  }
  return 'member';
}

export function toWorkspace(dto: WorkspaceItemDto): Workspace {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? null,
    role: parseWorkspaceRole(dto.role),
    createdAt: new Date(dto.createdAt),
    updatedAt: new Date(dto.updatedAt),
    archivedAt: dto.archivedAt ? new Date(dto.archivedAt) : null,
    mark: deriveWorkspaceMark(dto.name)
  };
}

export function toWorkspaceListItem(dto: WorkspaceListItemDto): WorkspaceListItem {
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description ?? null,
    role: parseWorkspaceRole(dto.role),
    createdAt: new Date(dto.createdAt),
    mark: deriveWorkspaceMark(dto.name)
  };
}

export function toWorkspaceListResult(dto: ListWorkspacesResponseDto): WorkspaceListResult {
  return {
    items: dto.items.map(toWorkspaceListItem),
    pagination: {
      limit: dto.pagination.limit,
      offset: dto.pagination.offset,
      total: dto.pagination.total
    }
  };
}

export function toCreateWorkspaceRequestDto(
  input: CreateWorkspaceInput
): CreateWorkspaceRequestDto {
  return {
    name: input.name.trim(),
    ...(input.description !== undefined && input.description !== null
      ? { description: input.description.trim() || null }
      : {})
  };
}

export function toUpdateWorkspaceRequestDto(
  input: UpdateWorkspaceInput
): UpdateWorkspaceRequestDto {
  const result: { name?: string; description?: string | null } = {};

  if (input.name !== undefined) {
    result.name = input.name.trim();
  }

  if (input.description !== undefined) {
    result.description = input.description === null ? null : input.description.trim() || null;
  }

  return result;
}

export function toArchiveWorkspaceResult(dto: ArchiveWorkspaceResponseDto): ArchiveWorkspaceResult {
  return {
    id: dto.workspace.id,
    archivedAt: new Date(dto.workspace.archivedAt)
  };
}
