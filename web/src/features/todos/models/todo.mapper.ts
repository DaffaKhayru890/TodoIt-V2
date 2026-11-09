import { ApiError } from '@/core/errors/api-error';
import type {
  CreateTodoRequestDto,
  TodoDto,
  TodoListResponseDto,
  UpdateTodoRequestDto
} from './todo.dto';
import {
  isTodoPriority,
  isTodoStatus,
  type CreateTodoInput,
  type Todo,
  type TodoListResult,
  type TodoPriority,
  type TodoStatus,
  type UpdateTodoInput
} from './todo.model';

function parseStatus(value: string): TodoStatus {
  if (!isTodoStatus(value)) {
    throw new ApiError('Status todo dari server tidak dikenal.', 0, 'INVALID_TODO_RESPONSE');
  }

  return value;
}

function parsePriority(value: string): TodoPriority {
  if (!isTodoPriority(value)) {
    throw new ApiError('Prioritas todo dari server tidak dikenal.', 0, 'INVALID_TODO_RESPONSE');
  }

  return value;
}

function parseDate(value: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError('Tanggal todo dari server tidak valid.', 0, 'INVALID_TODO_RESPONSE');
  }

  return date;
}

function parseNullableDate(value: string | null): Date | null {
  return value === null ? null : parseDate(value);
}

/** Serialisasi instant ke ISO 8601 UTC dengan timezone eksplisit. */
export function toIsoInstant(value: Date): string {
  return value.toISOString();
}

export function toTodo(dto: TodoDto): Todo {
  return {
    id: dto.id,
    workspaceId: dto.workspaceId,
    title: dto.title,
    description: dto.description ?? null,
    status: parseStatus(dto.status),
    priority: parsePriority(dto.priority),
    dueAt: parseNullableDate(dto.dueAt),
    completedAt: parseNullableDate(dto.completedAt),
    label: dto.label ? { ...dto.label } : null,
    tags: dto.tags.map((tag) => ({ ...tag })),
    createdBy: dto.createdBy,
    createdAt: parseDate(dto.createdAt),
    updatedAt: parseDate(dto.updatedAt)
  };
}

export function toTodoListResult(dto: TodoListResponseDto): TodoListResult {
  return {
    items: dto.items.map(toTodo),
    pagination: {
      limit: dto.pagination.limit,
      hasMore: dto.pagination.hasMore,
      nextCursor: dto.pagination.nextCursor
    }
  };
}

export function toCreateTodoRequestDto(input: CreateTodoInput): CreateTodoRequestDto {
  return {
    title: input.title.trim(),
    description: input.description?.trim() || null,
    ...(input.priority !== undefined ? { priority: input.priority } : {}),
    ...(input.dueAt !== undefined
      ? { dueAt: input.dueAt === null ? null : toIsoInstant(input.dueAt) }
      : {})
  };
}

/**
 * Hanya mengirim field yang benar-benar berubah. Backend memakai PATCH dengan
 * `additionalProperties: false`, sehingga field undefined tidak boleh ikut
 * diserialkan. `dueAt: null` dan `labelId: null` berarti menghapus nilai.
 */
export function toUpdateTodoRequestDto(input: UpdateTodoInput): UpdateTodoRequestDto {
  const result: {
    title?: string;
    description?: string | null;
    status?: string;
    priority?: string;
    dueAt?: string | null;
    labelId?: string | null;
  } = {};

  if (input.title !== undefined) {
    result.title = input.title.trim();
  }

  if (input.description !== undefined) {
    result.description = input.description?.trim() || null;
  }

  if (input.status !== undefined) {
    result.status = input.status;
  }

  if (input.priority !== undefined) {
    result.priority = input.priority;
  }

  if (input.dueAt !== undefined) {
    result.dueAt = input.dueAt === null ? null : toIsoInstant(input.dueAt);
  }

  if (input.labelId !== undefined) {
    result.labelId = input.labelId;
  }

  return result;
}
