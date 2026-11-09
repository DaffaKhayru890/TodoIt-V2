import { describe, expect, test } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { toTodo } from '../models/todo.mapper';
import type { Todo } from '../models/todo.model';
import {
  addLocalDays,
  daysBetweenLocal,
  endOfLocalDay,
  formatDueDateLabel,
  getCustomRange,
  getDueDateStatus,
  getNextSevenDaysRange,
  getOverdueRange,
  getTodayRange,
  getTomorrowRange,
  groupTodosByDueDate,
  isSameLocalDay,
  isTodoOverdue,
  setLocalTime,
  startOfLocalDay
} from './due-date';

const now = new Date(2026, 10, 9, 12, 0, 0, 0);

function makeTodo(overrides: Partial<Todo> = {}): Todo {
  return { ...toTodo(makeTodoDto()), ...overrides };
}

describe('due-date helpers', () => {
  test('startOfLocalDay dan endOfLocalDay memakai batas hari lokal', () => {
    expect(startOfLocalDay(now)).toEqual(new Date(2026, 10, 9, 0, 0, 0, 0));
    expect(endOfLocalDay(now)).toEqual(new Date(2026, 10, 9, 23, 59, 59, 999));
  });

  test('addLocalDays dan setLocalTime mengembalikan Date baru', () => {
    const next = addLocalDays(now, 3);
    expect(next.getDate()).toBe(12);
    expect(now.getDate()).toBe(9);

    const atNine = setLocalTime(now, 9, 15);
    expect(atNine.getHours()).toBe(9);
    expect(atNine.getMinutes()).toBe(15);
    expect(atNine.getSeconds()).toBe(0);
    expect(now.getHours()).toBe(12);
  });

  test('isSameLocalDay membandingkan komponen kalender, bukan jam', () => {
    expect(isSameLocalDay(now, new Date(2026, 10, 9, 23, 59))).toBe(true);
    expect(isSameLocalDay(now, new Date(2026, 10, 10, 0, 0))).toBe(false);
  });

  test('getDueDateStatus membedakan none, completed, today, overdue, dan upcoming', () => {
    expect(getDueDateStatus(null, now, false)).toBe('none');
    expect(getDueDateStatus(new Date(2026, 10, 1), now, true)).toBe('completed');
    expect(getDueDateStatus(new Date(2026, 10, 9, 20, 0), now, false)).toBe('today');
    expect(getDueDateStatus(new Date(2026, 10, 8, 23, 59), now, false)).toBe('overdue');
    expect(getDueDateStatus(new Date(2026, 10, 10, 0, 1), now, false)).toBe('upcoming');
  });

  test('isTodoOverdue mengabaikan completed, cancelled, dan tanpa tenggat', () => {
    expect(isTodoOverdue({ status: 'todo', dueAt: new Date(2026, 10, 8) }, now)).toBe(true);
    expect(isTodoOverdue({ status: 'in_progress', dueAt: new Date(2026, 10, 8) }, now)).toBe(true);
    expect(isTodoOverdue({ status: 'completed', dueAt: new Date(2026, 10, 8) }, now)).toBe(false);
    expect(isTodoOverdue({ status: 'cancelled', dueAt: new Date(2026, 10, 8) }, now)).toBe(false);
    expect(isTodoOverdue({ status: 'todo', dueAt: null }, now)).toBe(false);
    expect(isTodoOverdue({ status: 'todo', dueAt: new Date(2026, 10, 9, 8) }, now)).toBe(false);
  });

  test('rentang today, tomorrow, next-7-days, overdue, dan custom', () => {
    expect(getTodayRange(now)).toEqual({
      from: new Date(2026, 10, 9, 0, 0, 0, 0),
      to: new Date(2026, 10, 9, 23, 59, 59, 999)
    });
    expect(getTomorrowRange(now)).toEqual({
      from: new Date(2026, 10, 10, 0, 0, 0, 0),
      to: new Date(2026, 10, 10, 23, 59, 59, 999)
    });
    expect(getNextSevenDaysRange(now)).toEqual({
      from: new Date(2026, 10, 9, 0, 0, 0, 0),
      to: new Date(2026, 10, 15, 23, 59, 59, 999)
    });
    expect(getOverdueRange(now)).toEqual({
      from: new Date(0),
      to: new Date(new Date(2026, 10, 9, 0, 0, 0, 0).getTime() - 1)
    });
    expect(getCustomRange(new Date(2026, 10, 1, 15), new Date(2026, 10, 5, 8))).toEqual({
      from: new Date(2026, 10, 1, 0, 0, 0, 0),
      to: new Date(2026, 10, 5, 23, 59, 59, 999)
    });
  });

  test('formatDueDateLabel memakai Hari ini, Besok, lalu tanggal', () => {
    expect(formatDueDateLabel(new Date(2026, 10, 9, 23), now)).toBe('Hari ini');
    expect(formatDueDateLabel(new Date(2026, 10, 10, 1), now)).toBe('Besok');
    expect(formatDueDateLabel(new Date(2026, 10, 20), now)).toMatch(/20.*Nov.*2026/);
  });

  test('groupTodosByDueDate mengelompokkan per hari lokal dan mengurutkan tanggal', () => {
    const later = makeTodo({ id: 'later', dueAt: new Date(2026, 10, 12, 9) });
    const tomorrow = makeTodo({ id: 'tomorrow', dueAt: new Date(2026, 10, 10, 9) });
    const today = makeTodo({ id: 'today', dueAt: new Date(2026, 10, 9, 9) });
    const withoutDue = makeTodo({ id: 'none', dueAt: null });

    const groups = groupTodosByDueDate([later, tomorrow, today, withoutDue], now);

    expect(groups.map((group) => group.label)).toEqual(['Hari ini', 'Besok', groups[2]!.label]);
    expect(groups[0]?.todos.map((todo) => todo.id)).toEqual(['today']);
    expect(groups[1]?.todos.map((todo) => todo.id)).toEqual(['tomorrow']);
    expect(groups[2]?.todos.map((todo) => todo.id)).toEqual(['later']);
    expect(groups[2]?.key).toBe('2026-11-12');
  });

  test('groupTodosByDueDate menggabungkan todo pada tanggal yang sama', () => {
    const first = makeTodo({ id: 'first', dueAt: new Date(2026, 10, 11, 8) });
    const second = makeTodo({ id: 'second', dueAt: new Date(2026, 10, 11, 17) });

    const groups = groupTodosByDueDate([first, second], now);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.todos.map((todo) => todo.id)).toEqual(['first', 'second']);
  });

  test('daysBetweenLocal menghitung selisih hari kalender', () => {
    expect(daysBetweenLocal(new Date(2026, 10, 9, 23), new Date(2026, 10, 10, 1))).toBe(1);
    expect(daysBetweenLocal(new Date(2026, 10, 9), new Date(2026, 10, 19))).toBe(10);
  });
});
