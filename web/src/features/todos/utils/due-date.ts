import type { Todo } from '../models/todo.model';
import { formatDate, formatGroupDate } from './date-format';

export type DueDateStatus = 'none' | 'upcoming' | 'today' | 'overdue' | 'completed';

export interface DueDateRange {
  readonly from: Date;
  readonly to: Date;
}

export interface UpcomingGroup {
  readonly key: string;
  readonly label: string;
  readonly todos: readonly Todo[];
}

const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Semua perhitungan tanggal kalender memakai timezone lokal pengguna.
 * `dueAt` dari backend adalah instant UTC; tampilan dan grouping memakai
 * calendar date lokal, bukan substring string ISO.
 */
export function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

export function endOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 23, 59, 59, 999);
}

export function addLocalDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

/** Set jam lokal tanpa mengubah komponen tanggal. */
export function setLocalTime(value: Date, hour: number, minute = 0): Date {
  const next = new Date(value);
  next.setHours(hour, minute, 0, 0);
  return next;
}

export function isSameLocalDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

export function getDueDateStatus(
  dueAt: Date | null,
  now: Date,
  completed: boolean
): DueDateStatus {
  if (!dueAt) {
    return 'none';
  }

  if (completed) {
    return 'completed';
  }

  if (isSameLocalDay(dueAt, now)) {
    return 'today';
  }

  return dueAt.getTime() < startOfLocalDay(now).getTime() ? 'overdue' : 'upcoming';
}

export function isTodoOverdue(todo: Pick<Todo, 'dueAt' | 'status'>, now: Date): boolean {
  if (todo.status === 'completed' || todo.status === 'cancelled' || !todo.dueAt) {
    return false;
  }

  return todo.dueAt.getTime() < startOfLocalDay(now).getTime();
}

export function getTodayRange(now: Date): DueDateRange {
  return { from: startOfLocalDay(now), to: endOfLocalDay(now) };
}

export function getTomorrowRange(now: Date): DueDateRange {
  const tomorrow = addLocalDays(startOfLocalDay(now), 1);
  return { from: tomorrow, to: endOfLocalDay(tomorrow) };
}

export function getNextSevenDaysRange(now: Date): DueDateRange {
  const from = startOfLocalDay(now);
  return { from, to: endOfLocalDay(addLocalDays(from, 6)) };
}

/** Overdue = dueAt sebelum awal hari ini (batas atas inklusif 1 ms sebelumnya). */
export function getOverdueRange(now: Date): DueDateRange {
  const from = new Date(0);
  const to = new Date(startOfLocalDay(now).getTime() - 1);
  return { from, to };
}

export function getCustomRange(from: Date, to: Date): DueDateRange {
  return { from: startOfLocalDay(from), to: endOfLocalDay(to) };
}

/** Label pendek untuk badge due date. */
export function formatDueDateLabel(dueAt: Date, now: Date): string {
  if (isSameLocalDay(dueAt, now)) {
    return 'Hari ini';
  }

  if (isSameLocalDay(dueAt, addLocalDays(now, 1))) {
    return 'Besok';
  }

  return formatDate(dueAt);
}

/** Group todo berdasarkan calendar date lokal, tanpa mengubah input. */
export function groupTodosByDueDate(todos: readonly Todo[], now: Date): readonly UpcomingGroup[] {
  const groups = new Map<string, { label: string; todos: Todo[] }>();

  for (const todo of todos) {
    if (!todo.dueAt) {
      continue;
    }

    const key = `${todo.dueAt.getFullYear()}-${String(todo.dueAt.getMonth() + 1).padStart(2, '0')}-${String(todo.dueAt.getDate()).padStart(2, '0')}`;
    const existing = groups.get(key);

    if (existing) {
      existing.todos.push(todo);
      continue;
    }

    groups.set(key, {
      label: isSameLocalDay(todo.dueAt, now)
        ? 'Hari ini'
        : isSameLocalDay(todo.dueAt, addLocalDays(now, 1))
          ? 'Besok'
          : formatGroupDate(todo.dueAt),
      todos: [todo]
    });
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => ({ key, label: value.label, todos: value.todos }));
}

/** Rentang hari untuk endpoint Today/Upcoming; dipakai untuk label UI. */
export function daysBetweenLocal(left: Date, right: Date): number {
  return Math.round(
    (startOfLocalDay(right).getTime() - startOfLocalDay(left).getTime()) / MILLISECONDS_PER_DAY
  );
}
