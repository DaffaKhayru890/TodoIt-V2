/**
 * Domain model Todo untuk kebutuhan UI Phase 4.
 *
 * Nilai status dan priority mengikuti enum backend apa adanya. Phase 4 hanya
 * mengoperasikan status `todo`, `in_progress`, dan `completed`; `cancelled`
 * tetap dikenali agar data backend tidak salah dipetakan.
 */
export const TODO_STATUSES = ['todo', 'in_progress', 'completed', 'cancelled'] as const;

export type TodoStatus = (typeof TODO_STATUSES)[number];

export const TODO_PRIORITIES = ['low', 'medium', 'high', 'urgent'] as const;

export type TodoPriority = (typeof TODO_PRIORITIES)[number];

export interface TodoLabel {
  readonly id: string;
  readonly name: string;
  readonly color: string;
}

export interface TodoTag {
  readonly id: string;
  readonly name: string;
}

export interface Todo {
  readonly id: string;
  readonly workspaceId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: TodoStatus;
  readonly priority: TodoPriority;
  readonly dueAt: Date | null;
  readonly completedAt: Date | null;
  readonly label: TodoLabel | null;
  readonly tags: readonly TodoTag[];
  readonly createdBy: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface TodoPagination {
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface TodoListResult {
  readonly items: readonly Todo[];
  readonly pagination: TodoPagination;
}

export interface CreateTodoInput {
  readonly title: string;
  readonly description: string | null;
}

export interface UpdateTodoInput {
  readonly title?: string;
  readonly description?: string | null;
  readonly status?: TodoStatus;
}

export function isTodoStatus(value: string): value is TodoStatus {
  return (TODO_STATUSES as readonly string[]).includes(value);
}

export function isTodoPriority(value: string): value is TodoPriority {
  return (TODO_PRIORITIES as readonly string[]).includes(value);
}

/** Satu-satunya sumber kebenaran untuk status selesai. */
export function isTodoCompleted(todo: Pick<Todo, 'status'>): boolean {
  return todo.status === 'completed';
}

/** Todo yang masih dapat ditandai selesai: todo dan in_progress. */
export function isTodoActive(todo: Pick<Todo, 'status'>): boolean {
  return todo.status === 'todo' || todo.status === 'in_progress';
}

export function isTodoCancelled(todo: Pick<Todo, 'status'>): boolean {
  return todo.status === 'cancelled';
}

export function getTodoStatusLabel(status: TodoStatus): string {
  switch (status) {
    case 'todo':
      return 'Aktif';
    case 'in_progress':
      return 'Dikerjakan';
    case 'completed':
      return 'Selesai';
    case 'cancelled':
      return 'Dibatalkan';
  }
}

/**
 * Memisahkan item untuk section Active dan Completed. Todo `cancelled` tidak
 * ditampilkan pada Phase 4 karena pembatalan belum menjadi bagian fitur.
 */
export function splitTodosByStatus(todos: readonly Todo[]): {
  readonly active: readonly Todo[];
  readonly completed: readonly Todo[];
} {
  return {
    active: todos.filter(isTodoActive),
    completed: todos.filter(isTodoCompleted)
  };
}
