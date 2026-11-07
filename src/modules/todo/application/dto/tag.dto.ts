import type { Tag } from '../../domain/entities/tag';

export interface TagDto {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TagSummaryDto {
  readonly id: string;
  readonly name: string;
}

export interface TagListResponseDto {
  items: TagDto[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export function toTagDto(tag: Tag): TagDto {
  return {
    id: tag.id,
    workspaceId: tag.workspaceId,
    name: tag.name,
    createdAt: tag.createdAt,
    updatedAt: tag.updatedAt
  };
}

export function toTagSummaryDto(tag: Tag): TagSummaryDto {
  return { id: tag.id, name: tag.name };
}
