import { Todo } from '../../domain/entities/todo';
import type { TodoPriority } from '../../domain/enums/todo-priority';
import type { TodoStatus } from '../../domain/enums/todo-status';
import type { todos } from '../persistence/todo.schema';

export type TodoRow = typeof todos.$inferSelect;

export function toTodoEntity(row: TodoRow): Todo {
  return Todo.restore({
    id: row.id,
    workspaceId: row.workspaceId,
    title: row.title,
    description: row.description,
    status: row.status as TodoStatus,
    priority: row.priority as TodoPriority,
    dueAt: row.dueAt,
    completedAt: row.completedAt,
    labelId: row.labelId,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    deletedAt: row.deletedAt
  });
}
