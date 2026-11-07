import type { Todo } from '../../src/modules/todo/domain/entities/todo';
import type {
  SoftDeleteTodoCommand,
  TodoListQuery,
  TodoListResult,
  TodoRepository
} from '../../src/modules/todo/domain/repositories/todo.repository';

function matchesSearch(todo: Todo, search: string): boolean {
  const needle = search.toLowerCase();

  return (
    todo.title.toLowerCase().includes(needle) ||
    (todo.description !== null && todo.description.toLowerCase().includes(needle))
  );
}

/**
 * Implementasi in-memory yang meniru semantik SQL repository: filter dilakukan
 * sebelum paginasi, order createdAt DESC lalu id DESC, cursor bersifat keyset,
 * dan soft-deleted todo tidak pernah terlihat.
 */
export class InMemoryTodoRepository implements TodoRepository {
  readonly todos: Todo[] = [];

  /**
   * Association todo-tag dipakai bersama dengan InMemoryTagRepository. Disimpan
   * terpisah karena Todo entity tidak memuat koleksi tag (dimuat batch oleh
   * TodoMetadataService).
   */
  readonly todoTagIds = new Map<string, Set<string>>();

  async create(todo: Todo): Promise<Todo> {
    this.todos.push(todo);
    return todo;
  }

  async findActiveById(workspaceId: string, todoId: string): Promise<Todo | null> {
    return (
      this.todos.find(
        (todo) => todo.workspaceId === workspaceId && todo.id === todoId && !todo.isDeleted
      ) ?? null
    );
  }

  async update(todo: Todo): Promise<Todo | null> {
    const index = this.todos.findIndex(
      (candidate) =>
        candidate.workspaceId === todo.workspaceId &&
        candidate.id === todo.id &&
        !candidate.isDeleted
    );

    if (index < 0) {
      return null;
    }

    this.todos[index] = todo;
    return todo;
  }

  async softDelete(command: SoftDeleteTodoCommand): Promise<boolean> {
    const index = this.todos.findIndex(
      (candidate) =>
        candidate.workspaceId === command.workspaceId &&
        candidate.id === command.todoId &&
        !candidate.isDeleted
    );

    if (index < 0) {
      return false;
    }

    const existing = this.todos[index];

    if (!existing) {
      return false;
    }

    this.todos[index] = existing.softDelete(command.now);
    return true;
  }

  async list(query: TodoListQuery): Promise<TodoListResult> {
    const { criteria } = query;

    const filtered = this.todos.filter((todo) => {
      if (todo.workspaceId !== query.workspaceId || todo.isDeleted) {
        return false;
      }

      if (criteria.status !== undefined && todo.status !== criteria.status) {
        return false;
      }

      if (
        criteria.excludedStatuses !== undefined &&
        criteria.excludedStatuses.includes(todo.status)
      ) {
        return false;
      }

      if (criteria.priority !== undefined && todo.priority !== criteria.priority) {
        return false;
      }

      if (criteria.dueAtFrom !== undefined) {
        if (todo.dueAt === null || todo.dueAt.getTime() < criteria.dueAtFrom.getTime()) {
          return false;
        }
      }

      if (criteria.dueAtTo !== undefined) {
        if (todo.dueAt === null || todo.dueAt.getTime() > criteria.dueAtTo.getTime()) {
          return false;
        }
      }

      if (criteria.dueAtBefore !== undefined) {
        if (todo.dueAt === null || todo.dueAt.getTime() >= criteria.dueAtBefore.getTime()) {
          return false;
        }
      }

      if (criteria.createdFrom !== undefined) {
        if (todo.createdAt.getTime() < criteria.createdFrom.getTime()) {
          return false;
        }
      }

      if (criteria.createdTo !== undefined) {
        if (todo.createdAt.getTime() > criteria.createdTo.getTime()) {
          return false;
        }
      }

      if (criteria.search !== undefined && criteria.search.length > 0) {
        if (!matchesSearch(todo, criteria.search)) {
          return false;
        }
      }

      if (criteria.labelId !== undefined && todo.labelId !== criteria.labelId) {
        return false;
      }

      if (criteria.tagIds !== undefined && criteria.tagIds.length > 0) {
        const assigned = this.todoTagIds.get(todo.id);

        // Semantics ANY: minimal satu tag harus terpasang.
        if (
          !assigned ||
          !criteria.tagIds.some((tagId) => assigned.has(tagId))
        ) {
          return false;
        }
      }

      if (query.cursor !== null) {
        const createdAt = todo.createdAt.getTime();
        const cursorCreatedAt = query.cursor.createdAt.getTime();

        if (createdAt > cursorCreatedAt) {
          return false;
        }

        if (createdAt === cursorCreatedAt && todo.id >= query.cursor.id) {
          return false;
        }
      }

      return true;
    });

    filtered.sort((left, right) => {
      const difference = right.createdAt.getTime() - left.createdAt.getTime();

      if (difference !== 0) {
        return difference;
      }

      if (left.id === right.id) {
        return 0;
      }

      return left.id < right.id ? 1 : -1;
    });

    const hasMore = filtered.length > query.limit;
    const items = hasMore ? filtered.slice(0, query.limit) : filtered;

    return { items, hasMore };
  }
}
