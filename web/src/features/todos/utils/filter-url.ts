import {
  EMPTY_TODO_FILTER,
  isTodoDueFilter,
  isTodoStatusFilter,
  type TodoFilterState,
  type TodoDueFilter
} from '../models/todo-filter';
import { isTodoPriority, isTodoStatus, type Todo, type TodoListParams } from '../models/todo.model';
import { DEFAULT_TODO_SORT, isSortDirection, isTodoSortField, type TodoSort } from './sort-todos';
import {
  getCustomRange,
  getNextSevenDaysRange,
  getOverdueRange,
  getTodayRange,
  getTomorrowRange,
  startOfLocalDay
} from './due-date';
import { parseDateInputValue } from './date-format';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validDate(value: string | null): string | null {
  return value && DATE_PATTERN.test(value) && parseDateInputValue(value) ? value : null;
}

/** Parser defensif: parameter tidak dikenal atau tidak valid diabaikan. */
export function parseTodoFilter(searchParams: URLSearchParams): TodoFilterState {
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const due = searchParams.get('due');
  const labelId = searchParams.get('labelId');
  const tagIds = searchParams.getAll('tagIds').filter((value) => UUID_PATTERN.test(value));

  return {
    status: status && isTodoStatusFilter(status) ? status : EMPTY_TODO_FILTER.status,
    priority: priority && isTodoPriority(priority) ? priority : EMPTY_TODO_FILTER.priority,
    tagIds: [...new Set(tagIds)],
    labelId: labelId && UUID_PATTERN.test(labelId) ? labelId : null,
    due: due && isTodoDueFilter(due) ? due : EMPTY_TODO_FILTER.due,
    customFrom: validDate(searchParams.get('customFrom')),
    customTo: validDate(searchParams.get('customTo'))
  };
}

export function serializeTodoFilter(
  filter: TodoFilterState,
  current?: URLSearchParams
): URLSearchParams {
  const next = new URLSearchParams(current);

  for (const key of ['status', 'priority', 'tagIds', 'labelId', 'due', 'customFrom', 'customTo']) {
    next.delete(key);
  }

  if (filter.status !== 'all') next.set('status', filter.status);
  if (filter.priority !== 'all') next.set('priority', filter.priority);
  for (const tagId of filter.tagIds) next.append('tagIds', tagId);
  if (filter.labelId) next.set('labelId', filter.labelId);
  if (filter.due !== 'any') next.set('due', filter.due);

  if (filter.due === 'custom') {
    if (filter.customFrom) next.set('customFrom', filter.customFrom);
    if (filter.customTo) next.set('customTo', filter.customTo);
  }

  return next;
}

export function parseTodoSort(searchParams: URLSearchParams): TodoSort {
  const field = searchParams.get('sort');
  const direction = searchParams.get('dir');

  return {
    field: field && isTodoSortField(field) ? field : DEFAULT_TODO_SORT.field,
    direction: direction && isSortDirection(direction) ? direction : DEFAULT_TODO_SORT.direction
  };
}

export function serializeTodoSort(sort: TodoSort, current?: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(current);
  next.delete('sort');
  next.delete('dir');

  if (sort.field !== DEFAULT_TODO_SORT.field) {
    next.set('sort', sort.field);
  }

  if (sort.direction !== DEFAULT_TODO_SORT.direction) {
    next.set('dir', sort.direction);
  }

  return next;
}

export interface TodoListQueryPlan {
  readonly params: TodoListParams;
  /** Filter yang belum bisa diekspresikan API dan harus diterapkan ke item yang dimuat. */
  readonly clientFilter: 'none' | 'active' | 'no-date' | 'active-not-overdue';
}

/**
 * Menerjemahkan filter UI ke query parameter backend. Filter yang tidak
 * didukung API (mis. `no-date` dan status aktif gabungan) ditandai agar
 * diterapkan client-side dan didokumentasikan sebagai batasan pagination.
 */
export function toTodoListQueryPlan(filter: TodoFilterState, now: Date): TodoListQueryPlan {
  const params: {
    status?: NonNullable<TodoListParams['status']>;
    priority?: NonNullable<TodoListParams['priority']>;
    dueFrom?: Date;
    dueTo?: Date;
    tagIds?: readonly string[];
    labelId?: string;
  } = {};

  let clientFilter: TodoListQueryPlan['clientFilter'] = 'none';

  if (filter.status === 'completed') {
    params.status = 'completed';
  } else if (filter.status === 'active') {
    clientFilter = 'active';
  }

  if (filter.priority !== 'all') {
    params.priority = filter.priority;
  }

  if (filter.tagIds.length > 0) {
    params.tagIds = filter.tagIds;
  }

  if (filter.labelId) {
    params.labelId = filter.labelId;
  }

  if (filter.due === 'no-date') {
    clientFilter = 'no-date';
  } else if (filter.due !== 'any') {
    const range = resolveDueRange(filter, now);

    if (range) {
      params.dueFrom = range.from;
      params.dueTo = range.to;
    }

    if (filter.due === 'overdue' && filter.status !== 'completed') {
      clientFilter = 'active-not-overdue';
    }
  }

  return { params, clientFilter };
}

function resolveDueRange(filter: TodoFilterState, now: Date): { from: Date; to: Date } | null {
  switch (filter.due) {
    case 'today':
      return getTodayRange(now);
    case 'tomorrow':
      return getTomorrowRange(now);
    case 'next-7-days':
      return getNextSevenDaysRange(now);
    case 'overdue':
      return getOverdueRange(now);
    case 'custom': {
      const from = filter.customFrom ? parseDateInputValue(filter.customFrom) : null;
      const to = filter.customTo ? parseDateInputValue(filter.customTo) : null;

      if (!from || !to || from.getTime() > to.getTime()) {
        return null;
      }

      return getCustomRange(from, to);
    }
    default:
      return null;
  }
}

/** Client-side hanya untuk filter yang tidak bisa diekspresikan API. */
export function applyClientTodoFilter(
  todos: readonly Todo[],
  plan: TodoListQueryPlan,
  now: Date
): readonly Todo[] {
  switch (plan.clientFilter) {
    case 'active':
      return todos.filter((todo) => todo.status === 'todo' || todo.status === 'in_progress');
    case 'no-date':
      return todos.filter((todo) => todo.dueAt === null);
    case 'active-not-overdue':
      return todos.filter(
        (todo) =>
          (todo.status === 'todo' || todo.status === 'in_progress') &&
          todo.dueAt !== null &&
          todo.dueAt.getTime() < startOfLocalDay(now).getTime()
      );
    default:
      return todos;
  }
}

export function isOverdueFilter(filter: TodoFilterState): boolean {
  return filter.due === 'overdue';
}

export type { TodoDueFilter };
export type { TodoListParams };
export { isTodoStatus };
