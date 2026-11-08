export type WorkspaceRoleDto = 'owner' | 'admin' | 'member';

export interface WorkspaceItemDto {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly role: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly archivedAt: string | null;
}

export interface WorkspaceListItemDto {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly role: string;
  readonly createdAt: string;
}

export interface WorkspacePaginationDto {
  readonly limit: number;
  readonly offset: number;
  readonly total: number;
}

export interface ListWorkspacesResponseDto {
  readonly items: readonly WorkspaceListItemDto[];
  readonly pagination: WorkspacePaginationDto;
}

export interface WorkspaceDetailResponseDto {
  readonly workspace: WorkspaceItemDto;
}

export interface CreateWorkspaceRequestDto {
  readonly name: string;
  readonly description?: string | null;
}

export interface CreateWorkspaceResponseDto {
  readonly workspace: WorkspaceItemDto;
}

export interface UpdateWorkspaceRequestDto {
  readonly name?: string;
  readonly description?: string | null;
}

export interface UpdateWorkspaceResponseDto {
  readonly workspace: WorkspaceItemDto;
}

export interface ArchiveWorkspaceResponseDto {
  readonly workspace: {
    readonly id: string;
    readonly archivedAt: string;
  };
}
