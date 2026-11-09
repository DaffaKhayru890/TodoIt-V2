export interface TagDto {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface TagPaginationDto {
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface ListTagsResponseDto {
  readonly items: readonly TagDto[];
  readonly pagination: TagPaginationDto;
}

export interface TagResponseDto {
  readonly tag: TagDto;
}

export interface CreateTagRequestDto {
  readonly name: string;
}

export interface UpdateTagRequestDto {
  readonly name: string;
}

export interface TodoTagsResponseDto {
  readonly tags: readonly { readonly id: string; readonly name: string }[];
}
