import { ApiError } from '@/core/errors/api-error';
import type {
  CreateTagRequestDto,
  ListTagsResponseDto,
  TagDto,
  TodoTagsResponseDto,
  UpdateTagRequestDto
} from './tag.dto';
import type {
  CreateTagInput,
  Tag,
  TagListResult,
  TodoTagSummary,
  UpdateTagInput
} from './tag.model';

function parseDate(value: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError('Tanggal tag dari server tidak valid.', 0, 'INVALID_TAG_RESPONSE');
  }

  return date;
}

export function toTag(dto: TagDto): Tag {
  return {
    id: dto.id,
    workspaceId: dto.workspaceId,
    name: dto.name,
    createdAt: parseDate(dto.createdAt),
    updatedAt: parseDate(dto.updatedAt)
  };
}

export function toTagListResult(dto: ListTagsResponseDto): TagListResult {
  return {
    items: dto.items.map(toTag),
    pagination: {
      limit: dto.pagination.limit,
      hasMore: dto.pagination.hasMore,
      nextCursor: dto.pagination.nextCursor
    }
  };
}

export function toTodoTagSummaries(dto: TodoTagsResponseDto): readonly TodoTagSummary[] {
  return dto.tags.map((tag) => ({ id: tag.id, name: tag.name }));
}

export function toCreateTagRequestDto(input: CreateTagInput): CreateTagRequestDto {
  return { name: input.name.trim() };
}

export function toUpdateTagRequestDto(input: UpdateTagInput): UpdateTagRequestDto {
  return { name: input.name.trim() };
}
