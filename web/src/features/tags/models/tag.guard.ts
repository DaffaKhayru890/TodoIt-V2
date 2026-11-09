import { ApiError } from '@/core/errors/api-error';
import type {
  ListTagsResponseDto,
  TagDto,
  TagResponseDto,
  TodoTagsResponseDto
} from './tag.dto';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isTagDto(value: unknown): value is TagDto {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.workspaceId === 'string' &&
    typeof value.name === 'string' &&
    isIsoDate(value.createdAt) &&
    isIsoDate(value.updatedAt)
  );
}

function invalidResponse(): never {
  throw new ApiError('Respons tag dari server tidak valid.', 0, 'INVALID_TAG_RESPONSE');
}

export function assertTagResponseDto(value: unknown): asserts value is TagResponseDto {
  if (!isObject(value) || !isTagDto(value.tag)) {
    invalidResponse();
  }
}

export function assertTagListResponseDto(value: unknown): asserts value is ListTagsResponseDto {
  if (!isObject(value) || !Array.isArray(value.items) || !value.items.every(isTagDto)) {
    invalidResponse();
  }

  const pagination = value.pagination;

  if (
    !isObject(pagination) ||
    typeof pagination.limit !== 'number' ||
    typeof pagination.hasMore !== 'boolean' ||
    (pagination.nextCursor !== null && typeof pagination.nextCursor !== 'string')
  ) {
    invalidResponse();
  }
}

export function assertTodoTagsResponseDto(value: unknown): asserts value is TodoTagsResponseDto {
  if (
    !isObject(value) ||
    !Array.isArray(value.tags) ||
    !value.tags.every(
      (tag) =>
        isObject(tag) && typeof tag.id === 'string' && typeof tag.name === 'string'
    )
  ) {
    invalidResponse();
  }
}
