import { describe, expect, test } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { toTodo } from '../models/todo.mapper';
import type { Todo, TodoPriority } from '../models/todo.model';
import {
  DEFAULT_TODO_SORT,
  isSortDirection,
  isTodoSortField,
  sortTodos
} from './sort-todos';

function todo(
  id: string,
  overrides: Partial<{
    title: string;
    priority: TodoPriority;
    dueAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }> = {}
): Todo {
  return {
    ...toTodo(makeTodoDto({ id })),
    ...overrides
  };
}

function ids(todos: readonly Todo[]): string[] {
  return todos.map((item) => item.id);
}

describe('sort-todos', () => {
  test('default sorting adalah createdAt menurun', () => {
    expect(DEFAULT_TODO_SORT).toEqual({ field: 'createdAt', direction: 'desc' });
  });

  test('mengenali field dan arah sorting yang valid', () => {
    expect(isTodoSortField('title')).toBe(true);
    expect(isTodoSortField('dueDate')).toBe(true);
    expect(isTodoSortField('unknown')).toBe(false);
    expect(isSortDirection('asc')).toBe(true);
    expect(isSortDirection('desc')).toBe(true);
    expect(isSortDirection('naik')).toBe(false);
  });

  test('mengurutkan judul secara natural dan tidak mengubah input', () => {
    const input = [todo('10', { title: 'Task 10' }), todo('2', { title: 'Task 2' })];
    const snapshot = [...input];

    expect(ids(sortTodos(input, { field: 'title', direction: 'asc' }))).toEqual(['2', '10']);
    expect(ids(sortTodos(input, { field: 'title', direction: 'desc' }))).toEqual(['10', '2']);
    expect(input).toEqual(snapshot);
  });

  test('mengurutkan prioritas berdasarkan bobot backend', () => {
    const input = [
      todo('low', { priority: 'low' }),
      todo('urgent', { priority: 'urgent' }),
      todo('medium', { priority: 'medium' }),
      todo('high', { priority: 'high' })
    ];

    expect(ids(sortTodos(input, { field: 'priority', direction: 'asc' }))).toEqual([
      'low',
      'medium',
      'high',
      'urgent'
    ]);
    expect(ids(sortTodos(input, { field: 'priority', direction: 'desc' }))).toEqual([
      'urgent',
      'high',
      'medium',
      'low'
    ]);
  });

  test('tenggat kosong selalu berada di akhir', () => {
    const input = [
      todo('none', { dueAt: null }),
      todo('later', { dueAt: new Date(2026, 10, 20) }),
      todo('earlier', { dueAt: new Date(2026, 10, 10) })
    ];

    expect(ids(sortTodos(input, { field: 'dueDate', direction: 'asc' }))).toEqual([
      'earlier',
      'later',
      'none'
    ]);
    expect(ids(sortTodos(input, { field: 'dueDate', direction: 'desc' }))).toEqual([
      'later',
      'earlier',
      'none'
    ]);
  });

  test('mengurutkan createdAt dan updatedAt dua arah', () => {
    const input = [
      todo('second', { createdAt: new Date(2026, 10, 2), updatedAt: new Date(2026, 10, 1) }),
      todo('first', { createdAt: new Date(2026, 10, 1), updatedAt: new Date(2026, 10, 3) })
    ];

    expect(ids(sortTodos(input, { field: 'createdAt', direction: 'asc' }))).toEqual([
      'first',
      'second'
    ]);
    expect(ids(sortTodos(input, { field: 'updatedAt', direction: 'asc' }))).toEqual([
      'second',
      'first'
    ]);
  });

  test('tie-breaker judul membuat hasil deterministik', () => {
    const input = [
      todo('b', { title: 'Beta', priority: 'high' }),
      todo('a', { title: 'Alpha', priority: 'high' })
    ];

    expect(ids(sortTodos(input, { field: 'priority', direction: 'asc' }))).toEqual(['a', 'b']);
  });
});
