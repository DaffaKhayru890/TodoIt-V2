export interface Tag {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TagPagination {
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface TagListResult {
  readonly items: readonly Tag[];
  readonly pagination: TagPagination;
}

export interface TodoTagSummary {
  readonly id: string;
  readonly name: string;
}

export interface CreateTagInput {
  readonly name: string;
}

export interface UpdateTagInput {
  readonly name: string;
}

export interface ListTagsParams {
  readonly limit?: number;
  readonly cursor?: string;
  readonly q?: string;
}
