import { ApiError } from '@/core/errors/api-error';
import { isTodoPriority, isTodoStatus } from './todo.model';
import type {
  TodoDto,
  TodoLabelDto,
  TodoListResponseDto,
  TodoResponseDto,
  TodoTagDto
} from './todo.dto';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value);
}

function isTodoLabel(value: unknown): value is TodoLabelDto {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.name === 'string' &&
    typeof value.color === 'string'
  );
}

function isTodoTag(value: unknown): value is TodoTagDto {
  return isObject(value) && typeof value.id === 'string' && typeof value.name === 'string';
}

export function isTodoDto(value: unknown): value is TodoDto {
  if (!isObject(value)) {
    return false;
  }

  return (
    typeof value.id === 'string' &&
    typeof value.workspaceId === 'string' &&
    typeof value.title === 'string' &&
    isNullableString(value.description) &&
    typeof value.status === 'string' &&
    isTodoStatus(value.status) &&
    typeof value.priority === 'string' &&
    isTodoPriority(value.priority) &&
    isNullableIsoDate(value.dueAt) &&
    isNullableIsoDate(value.completedAt) &&
    (value.label === null || isTodoLabel(value.label)) &&
    Array.isArray(value.tags) &&
    value.tags.every(isTodoTag) &&
    typeof value.createdBy === 'string' &&
    isIsoDate(value.createdAt) &&
    isIsoDate(value.updatedAt)
  );
}

function invalidResponse(): never {
  throw new ApiError('Respons todo dari server tidak valid.', 0, 'INVALID_TODO_RESPONSE');
}

export function assertTodoDto(value: unknown): asserts value is TodoDto {
  if (!isTodoDto(value)) {
    invalidResponse();
  }
}

export function assertTodoResponseDto(value: unknown): asserts value is TodoResponseDto {
  if (!isObject(value) || !isTodoDto(value.todo)) {
    invalidResponse();
  }
}

export function assertTodoListResponseDto(value: unknown): asserts value is TodoListResponseDto {
  if (!isObject(value) || !Array.isArray(value.items) || !value.items.every(isTodoDto)) {
    invalidResponse();
  }

  const pagination = value.pagination;

  if (
    !isObject(pagination) ||
    typeof pagination.limit !== 'number' ||
    typeof pagination.hasMore !== 'boolean' ||
    !isNullableString(pagination.nextCursor)
  ) {
    invalidResponse();
  }
}
