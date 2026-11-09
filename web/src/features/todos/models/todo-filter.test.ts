import { describe, expect, test } from 'vitest';
import {
  EMPTY_TODO_FILTER,
  countActiveTodoFilters,
  hasActiveTodoFilters,
  isTodoDueFilter,
  isTodoStatusFilter
} from './todo-filter';

describe('todo-filter', () => {
  test('mengenali nilai status filter yang valid saja', () => {
    expect(isTodoStatusFilter('all')).toBe(true);
    expect(isTodoStatusFilter('active')).toBe(true);
    expect(isTodoStatusFilter('completed')).toBe(true);
    expect(isTodoStatusFilter('todo')).toBe(false);
  });

  test('mengenali nilai due filter yang valid saja', () => {
    expect(isTodoDueFilter('any')).toBe(true);
    expect(isTodoDueFilter('no-date')).toBe(true);
    expect(isTodoDueFilter('overdue')).toBe(true);
    expect(isTodoDueFilter('custom')).toBe(true);
    expect(isTodoDueFilter('yesterday')).toBe(false);
  });

  test('EMPTY_TODO_FILTER tidak dianggap aktif', () => {
    expect(hasActiveTodoFilters(EMPTY_TODO_FILTER)).toBe(false);
    expect(countActiveTodoFilters(EMPTY_TODO_FILTER)).toBe(0);
  });

  test('menghitung setiap kategori filter termasuk jumlah tag', () => {
    expect(
      countActiveTodoFilters({
        ...EMPTY_TODO_FILTER,
        status: 'active',
        priority: 'high',
        tagIds: ['tag-1', 'tag-2'],
        labelId: 'label-1',
        due: 'today'
      })
    ).toBe(6);
  });

  test('labelId null tidak dihitung, labelId string dihitung', () => {
    expect(countActiveTodoFilters({ ...EMPTY_TODO_FILTER, labelId: null })).toBe(0);
    expect(countActiveTodoFilters({ ...EMPTY_TODO_FILTER, labelId: 'label-1' })).toBe(1);
    expect(hasActiveTodoFilters({ ...EMPTY_TODO_FILTER, labelId: 'label-1' })).toBe(true);
  });

  test('due selain any dan tag kosong memengaruhi status aktif', () => {
    expect(hasActiveTodoFilters({ ...EMPTY_TODO_FILTER, due: 'no-date' })).toBe(true);
    expect(hasActiveTodoFilters({ ...EMPTY_TODO_FILTER, tagIds: ['tag-1'] })).toBe(true);
    expect(hasActiveTodoFilters({ ...EMPTY_TODO_FILTER, priority: 'urgent' })).toBe(true);
    expect(hasActiveTodoFilters({ ...EMPTY_TODO_FILTER, status: 'completed' })).toBe(true);
  });
});
