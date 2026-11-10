import { getPriorityWeight } from '../models/todo-priority';
import type { Todo } from '../models/todo.model';

export const TODO_SORT_FIELDS = ['title', 'dueDate', 'priority', 'createdAt', 'updatedAt'] as const;

export type TodoSortField = (typeof TODO_SORT_FIELDS)[number];

export const SORT_DIRECTIONS = ['asc', 'desc'] as const;

export type SortDirection = (typeof SORT_DIRECTIONS)[number];

export interface TodoSort {
  readonly field: TodoSortField;
  readonly direction: SortDirection;
}

export const DEFAULT_TODO_SORT: TodoSort = {
  field: 'createdAt',
  direction: 'desc'
};

export const TODO_SORT_LABELS: Record<TodoSortField, string> = {
  title: 'Judul',
  dueDate: 'Tenggat',
  priority: 'Prioritas',
  createdAt: 'Tanggal dibuat',
  updatedAt: 'Terakhir diperbarui'
};

const collator = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: 'base'
});

export function isTodoSortField(value: string): value is TodoSortField {
  return (TODO_SORT_FIELDS as readonly string[]).includes(value);
}

export function isSortDirection(value: string): value is SortDirection {
  return (SORT_DIRECTIONS as readonly string[]).includes(value);
}

function compareTitle(left: Todo, right: Todo): number {
  return collator.compare(left.title, right.title);
}

function compareDate(left: Date | null, right: Date | null, direction: SortDirection): number {
  // Tanggal kosong selalu di akhir, terlepas dari arah sorting.
  if (left === null && right === null) {
    return 0;
  }

  if (left === null) {
    return 1;
  }

  if (right === null) {
    return -1;
  }

  const diff = left.getTime() - right.getTime();
  return direction === 'asc' ? diff : -diff;
}

function compareByField(left: Todo, right: Todo, sort: TodoSort): number {
  switch (sort.field) {
    case 'title': {
      const result = compareTitle(left, right);
      return sort.direction === 'asc' ? result : -result;
    }

    case 'priority': {
      const result = getPriorityWeight(left.priority) - getPriorityWeight(right.priority);
      return sort.direction === 'asc' ? result : -result;
    }

    case 'dueDate':
      return compareDate(left.dueAt, right.dueAt, sort.direction);

    case 'createdAt':
      return compareDate(left.createdAt, right.createdAt, sort.direction);

    case 'updatedAt':
      return compareDate(left.updatedAt, right.updatedAt, sort.direction);
  }
}

/**
 * Pure dan immutable. Array input tidak pernah diubah. Tie-breaker judul
 * memakai Intl.Collator agar hasil deterministik dan natural (Task 2 < Task 10).
 */
export function sortTodos(todos: readonly Todo[], sort: TodoSort): readonly Todo[] {
  return [...todos].sort((left, right) => {
    const primary = compareByField(left, right, sort);

    if (primary !== 0) {
      return primary;
    }

    return compareTitle(left, right);
  });
}
