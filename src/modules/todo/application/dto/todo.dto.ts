import type { Todo } from '../../domain/entities/todo';

export interface TodoLabelDto {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface TodoTagDto {
  readonly id: string;
  readonly name: string;
}

export interface TodoRelationsDto {
  readonly label: TodoLabelDto | null;
  readonly tags: TodoTagDto[];
}

export const EMPTY_TODO_RELATIONS: TodoRelationsDto = { label: null, tags: [] };

/**
 * Output DTO application layer. Tidak ada model Drizzle yang bocor ke
 * presentation: route hanya menerima bentuk ini lalu memvalidasinya lewat
 * response schema.
 */
export interface TodoDto {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: string;
  readonly priority: string;
  readonly dueAt: Date | null;
  readonly completedAt: Date | null;
  readonly label: TodoLabelDto | null;
  readonly tags: TodoTagDto[];
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TodoListResponseDto {
  items: TodoDto[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export function toTodoDto(
  todo: Todo,
  relations: TodoRelationsDto = EMPTY_TODO_RELATIONS
): TodoDto {
  return {
    id: todo.id,
    workspaceId: todo.workspaceId,
    title: todo.title,
    description: todo.description,
    status: todo.status,
    priority: todo.priority,
    dueAt: todo.dueAt,
    completedAt: todo.completedAt,
    label: relations.label,
    tags: [...relations.tags],
    createdBy: todo.createdBy,
    createdAt: todo.createdAt,
    updatedAt: todo.updatedAt
  };
}
