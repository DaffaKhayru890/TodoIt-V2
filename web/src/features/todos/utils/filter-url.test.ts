import { describe, expect, test } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { toTodo } from '../models/todo.mapper';
import { EMPTY_TODO_FILTER, type TodoFilterState } from '../models/todo-filter';
import {
  applyClientTodoFilter,
  isOverdueFilter,
  parseTodoFilter,
  parseTodoSort,
  serializeTodoFilter,
  serializeTodoSort,
  toTodoListQueryPlan
} from './filter-url';

const now = new Date(2026, 10, 9, 12, 0, 0, 0);
const tagA = 'a1111111-1111-4111-8111-111111111111';
const tagB = 'a2222222-2222-4222-8222-222222222222';
const labelId = 'b1111111-1111-4111-8111-111111111111';

function filter(overrides: Partial<TodoFilterState> = {}): TodoFilterState {
  return { ...EMPTY_TODO_FILTER, ...overrides };
}

describe('parseTodoFilter', () => {
  test('mengembalikan filter kosong untuk parameter tidak ada', () => {
    expect(parseTodoFilter(new URLSearchParams())).toEqual(EMPTY_TODO_FILTER);
  });

  test('membaca seluruh filter valid dan menghapus tag duplikat', () => {
    const params = new URLSearchParams([
      ['status', 'completed'],
      ['priority', 'urgent'],
      ['tagIds', tagA],
      ['tagIds', tagA],
      ['tagIds', tagB],
      ['labelId', labelId],
      ['due', 'custom'],
      ['customFrom', '2026-11-01'],
      ['customTo', '2026-11-09']
    ]);

    expect(parseTodoFilter(params)).toEqual({
      status: 'completed',
      priority: 'urgent',
      tagIds: [tagA, tagB],
      labelId,
      due: 'custom',
      customFrom: '2026-11-01',
      customTo: '2026-11-09'
    });
  });

  test('mengabaikan nilai tidak valid secara defensif', () => {
    const params = new URLSearchParams([
      ['status', 'todo'],
      ['priority', 'critical'],
      ['tagIds', 'bukan-uuid'],
      ['labelId', 'bukan-uuid'],
      ['due', 'yesterday'],
      ['customFrom', '2026-02-30']
    ]);

    expect(parseTodoFilter(params)).toEqual(EMPTY_TODO_FILTER);
  });
});

describe('serializeTodoFilter', () => {
  test('menghapus key filter lama dan mempertahankan parameter lain', () => {
    const current = new URLSearchParams('sort=title&status=completed&tagIds=old');
    const serialized = serializeTodoFilter(filter(), current);

    expect(serialized.get('sort')).toBe('title');
    expect(serialized.get('status')).toBeNull();
    expect(serialized.has('tagIds')).toBe(false);
  });

  test('menulis filter aktif dua arah dan tag berulang', () => {
    const serialized = serializeTodoFilter(
      filter({
        status: 'active',
        priority: 'high',
        tagIds: [tagA, tagB],
        labelId,
        due: 'overdue'
      })
    );

    expect(serialized.get('status')).toBe('active');
    expect(serialized.get('priority')).toBe('high');
    expect(serialized.getAll('tagIds')).toEqual([tagA, tagB]);
    expect(serialized.get('labelId')).toBe(labelId);
    expect(serialized.get('due')).toBe('overdue');
  });

  test('customFrom/customTo hanya ditulis ketika due custom', () => {
    const nonCustom = serializeTodoFilter(
      filter({ due: 'today', customFrom: '2026-11-01', customTo: '2026-11-02' })
    );
    expect(nonCustom.get('customFrom')).toBeNull();
    expect(nonCustom.get('customTo')).toBeNull();

    const custom = serializeTodoFilter(
      filter({ due: 'custom', customFrom: '2026-11-01', customTo: '2026-11-02' })
    );
    expect(custom.get('customFrom')).toBe('2026-11-01');
    expect(custom.get('customTo')).toBe('2026-11-02');
  });
});

describe('parseTodoSort / serializeTodoSort', () => {
  test('default ketika parameter tidak valid', () => {
    expect(parseTodoSort(new URLSearchParams('sort=unknown&dir=naik'))).toEqual({
      field: 'createdAt',
      direction: 'desc'
    });
  });

  test('membaca sorting valid', () => {
    expect(parseTodoSort(new URLSearchParams('sort=priority&dir=asc'))).toEqual({
      field: 'priority',
      direction: 'asc'
    });
  });

  test('default tidak ditulis ke URL dan key lain dipertahankan', () => {
    const serialized = serializeTodoSort(
      { field: 'createdAt', direction: 'desc' },
      new URLSearchParams('status=active')
    );

    expect(serialized.get('sort')).toBeNull();
    expect(serialized.get('dir')).toBeNull();
    expect(serialized.get('status')).toBe('active');
  });

  test('sorting non-default ditulis ke URL', () => {
    const serialized = serializeTodoSort({ field: 'title', direction: 'asc' });
    expect(serialized.get('sort')).toBe('title');
    expect(serialized.get('dir')).toBe('asc');
  });
});

describe('toTodoListQueryPlan', () => {
  test('tanpa filter hanya mengirim parameter halaman yang diberikan hook', () => {
    expect(toTodoListQueryPlan(filter(), now)).toEqual({ params: {}, clientFilter: 'none' });
  });

  test('status completed dikirim server-side, active diterapkan client-side', () => {
    expect(toTodoListQueryPlan(filter({ status: 'completed' }), now).params.status).toBe(
      'completed'
    );

    const active = toTodoListQueryPlan(filter({ status: 'active' }), now);
    expect(active.params.status).toBeUndefined();
    expect(active.clientFilter).toBe('active');
  });

  test('priority, tagIds, dan labelId diteruskan ke API', () => {
    const plan = toTodoListQueryPlan(
      filter({ priority: 'urgent', tagIds: [tagA, tagB], labelId }),
      now
    );

    expect(plan.params).toMatchObject({
      priority: 'urgent',
      tagIds: [tagA, tagB],
      labelId
    });
  });

  test('due today/tomorrow/next-7-days memakai rentang lokal', () => {
    const today = toTodoListQueryPlan(filter({ due: 'today' }), now);
    expect(today.params.dueFrom).toEqual(new Date(2026, 10, 9, 0, 0, 0, 0));
    expect(today.params.dueTo).toEqual(new Date(2026, 10, 9, 23, 59, 59, 999));

    expect(toTodoListQueryPlan(filter({ due: 'tomorrow' }), now).params.dueFrom).toEqual(
      new Date(2026, 10, 10, 0, 0, 0, 0)
    );
    expect(toTodoListQueryPlan(filter({ due: 'next-7-days' }), now).params.dueTo).toEqual(
      new Date(2026, 10, 15, 23, 59, 59, 999)
    );
  });

  test('overdue memakai batas atas awal hari ini dan filter client-side', () => {
    const plan = toTodoListQueryPlan(filter({ due: 'overdue' }), now);

    expect(plan.params.dueTo).toEqual(
      new Date(new Date(2026, 10, 9, 0, 0, 0, 0).getTime() - 1)
    );
    expect(plan.clientFilter).toBe('active-not-overdue');
  });

  test('overdue dengan status completed tidak memakai filter client-side', () => {
    const plan = toTodoListQueryPlan(filter({ due: 'overdue', status: 'completed' }), now);
    expect(plan.params.status).toBe('completed');
    expect(plan.clientFilter).toBe('none');
  });

  test('no-date menandai filter client-side tanpa dueFrom/dueTo', () => {
    const plan = toTodoListQueryPlan(filter({ due: 'no-date' }), now);
    expect(plan.params.dueFrom).toBeUndefined();
    expect(plan.params.dueTo).toBeUndefined();
    expect(plan.clientFilter).toBe('no-date');
  });

  test('custom hanya dipakai jika rentang valid', () => {
    const valid = toTodoListQueryPlan(
      filter({ due: 'custom', customFrom: '2026-11-01', customTo: '2026-11-05' }),
      now
    );
    expect(valid.params.dueFrom).toEqual(new Date(2026, 10, 1, 0, 0, 0, 0));
    expect(valid.params.dueTo).toEqual(new Date(2026, 10, 5, 23, 59, 59, 999));

    const reversed = toTodoListQueryPlan(
      filter({ due: 'custom', customFrom: '2026-11-05', customTo: '2026-11-01' }),
      now
    );
    expect(reversed.params.dueFrom).toBeUndefined();
    expect(reversed.params.dueTo).toBeUndefined();

    const incomplete = toTodoListQueryPlan(filter({ due: 'custom' }), now);
    expect(incomplete.params.dueFrom).toBeUndefined();
  });
});

describe('applyClientTodoFilter', () => {
  const activeTodo = toTodo(makeTodoDto({ id: 'active', status: 'todo' }));
  const inProgress = toTodo(makeTodoDto({ id: 'in-progress', status: 'in_progress' }));
  const completed = toTodo(makeTodoDto({ id: 'completed', status: 'completed' }));
  const cancelled = toTodo(makeTodoDto({ id: 'cancelled', status: 'cancelled' }));
  const overdue = toTodo(
    makeTodoDto({ id: 'overdue', status: 'todo', dueAt: '2026-11-08T09:00:00.000Z' })
  );
  const withDue = toTodo(
    makeTodoDto({ id: 'with-due', dueAt: '2026-11-10T09:00:00.000Z' })
  );
  const all = [activeTodo, inProgress, completed, cancelled, overdue, withDue];

  test('none mengembalikan input apa adanya', () => {
    expect(applyClientTodoFilter(all, { params: {}, clientFilter: 'none' }, now)).toBe(all);
  });

  test('active hanya menyisakan todo dan in_progress', () => {
    const result = applyClientTodoFilter(all, { params: {}, clientFilter: 'active' }, now);
    expect(result.map((item) => item.id)).toEqual(['active', 'in-progress', 'overdue', 'with-due']);
  });

  test('no-date hanya menyisakan todo tanpa tenggat', () => {
    const result = applyClientTodoFilter(all, { params: {}, clientFilter: 'no-date' }, now);
    expect(result.map((item) => item.id)).toEqual([
      'active',
      'in-progress',
      'completed',
      'cancelled'
    ]);
  });

  test('active-not-overdue hanya menyisakan todo aktif yang sudah melewati hari ini', () => {
    const result = applyClientTodoFilter(
      all,
      { params: {}, clientFilter: 'active-not-overdue' },
      now
    );
    expect(result.map((item) => item.id)).toEqual(['overdue']);
  });

  test('isOverdueFilter membaca due=overdue', () => {
    expect(isOverdueFilter(filter({ due: 'overdue' }))).toBe(true);
    expect(isOverdueFilter(filter({ due: 'today' }))).toBe(false);
  });
});
