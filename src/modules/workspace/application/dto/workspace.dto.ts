export interface WorkspaceDto {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly role: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly archivedAt: Date | null;
}

export interface WorkspaceListItemDto {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly role: string;
  readonly createdAt: Date;
}

export interface WorkspaceListResponseDto {
  readonly items: readonly WorkspaceListItemDto[];
  readonly pagination: {
    readonly limit: number;
    readonly offset: number;
    readonly total: number;
  };
}
