import type { TodoPriority } from './todo.model';

export const TODO_STATUS_FILTERS = ['all', 'active', 'completed'] as const;

export type TodoStatusFilter = (typeof TODO_STATUS_FILTERS)[number];

export const TODO_DUE_FILTERS = [
  'any',
  'no-date',
  'today',
  'tomorrow',
  'next-7-days',
  'overdue',
  'custom'
] as const;

export type TodoDueFilter = (typeof TODO_DUE_FILTERS)[number];

export interface TodoFilterState {
  readonly status: TodoStatusFilter;
  readonly priority: TodoPriority | 'all';
  readonly tagIds: readonly string[];
  readonly labelId: string | null;
  readonly due: TodoDueFilter;
  /** Tanggal lokal `YYYY-MM-DD`, hanya untuk due=custom. */
  readonly customFrom: string | null;
  readonly customTo: string | null;
}

export const EMPTY_TODO_FILTER: TodoFilterState = {
  status: 'all',
  priority: 'all',
  tagIds: [],
  labelId: null,
  due: 'any',
  customFrom: null,
  customTo: null
};

export const TODO_STATUS_FILTER_LABELS: Record<TodoStatusFilter, string> = {
  all: 'Semua',
  active: 'Aktif',
  completed: 'Selesai'
};

export const TODO_DUE_FILTER_LABELS: Record<TodoDueFilter, string> = {
  any: 'Semua tenggat',
  'no-date': 'Tanpa tenggat',
  today: 'Hari ini',
  tomorrow: 'Besok',
  'next-7-days': '7 hari ke depan',
  overdue: 'Terlambat',
  custom: 'Rentang khusus'
};

export function isTodoStatusFilter(value: string): value is TodoStatusFilter {
  return (TODO_STATUS_FILTERS as readonly string[]).includes(value);
}

export function isTodoDueFilter(value: string): value is TodoDueFilter {
  return (TODO_DUE_FILTERS as readonly string[]).includes(value);
}

export function hasActiveTodoFilters(filter: TodoFilterState): boolean {
  return (
    filter.status !== 'all' ||
    filter.priority !== 'all' ||
    filter.tagIds.length > 0 ||
    filter.labelId !== null ||
    filter.due !== 'any'
  );
}

export function countActiveTodoFilters(filter: TodoFilterState): number {
  let count = 0;

  if (filter.status !== 'all') count += 1;
  if (filter.priority !== 'all') count += 1;
  count += filter.tagIds.length;
  if (filter.labelId !== null) count += 1;
  if (filter.due !== 'any') count += 1;

  return count;
}
