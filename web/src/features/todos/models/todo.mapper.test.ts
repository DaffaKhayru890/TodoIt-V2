import { describe, expect, test } from 'vitest';
import { ApiError } from '@/core/errors/api-error';
import { makeTodoDto } from '@/test/fixtures/todos';
import {
  toCreateTodoRequestDto,
  toTodo,
  toTodoListResult,
  toUpdateTodoRequestDto
} from './todo.mapper';
import {
  getTodoStatusLabel,
  isTodoActive,
  isTodoCancelled,
  isTodoCompleted,
  splitTodosByStatus
} from './todo.model';

describe('todo.mapper', () => {
  test('toTodo memetakan DTO ke domain model termasuk Date, label, dan tag', () => {
    const todo = toTodo(
      makeTodoDto({
        status: 'in_progress',
        priority: 'high',
        dueAt: '2026-11-10T09:00:00.000Z',
        label: { id: 'label-1', name: 'Penting', color: '#ff0000' },
        tags: [{ id: 'tag-1', name: 'backend' }]
      })
    );

    expect(todo.status).toBe('in_progress');
    expect(todo.priority).toBe('high');
    expect(todo.dueAt).toBeInstanceOf(Date);
    expect(todo.completedAt).toBeNull();
    expect(todo.label).toEqual({ id: 'label-1', name: 'Penting', color: '#ff0000' });
    expect(todo.tags).toEqual([{ id: 'tag-1', name: 'backend' }]);
    expect(todo.createdAt).toBeInstanceOf(Date);
    expect(todo.updatedAt).toBeInstanceOf(Date);
  });

  test('toTodo mempertahankan description null dan completedAt', () => {
    const todo = toTodo(
      makeTodoDto({
        description: null,
        status: 'completed',
        completedAt: '2026-11-07T11:00:00.000Z'
      })
    );

    expect(todo.description).toBeNull();
    expect(todo.completedAt).toEqual(new Date('2026-11-07T11:00:00.000Z'));
  });

  test('toTodoListResult memetakan item dan metadata pagination', () => {
    const result = toTodoListResult({
      items: [makeTodoDto()],
      pagination: { limit: 100, hasMore: true, nextCursor: 'cursor-1' }
    });

    expect(result.items).toHaveLength(1);
    expect(result.pagination).toEqual({
      limit: 100,
      hasMore: true,
      nextCursor: 'cursor-1'
    });
  });

  test('toCreateTodoRequestDto melakukan trim dan menormalkan deskripsi kosong', () => {
    expect(
      toCreateTodoRequestDto({ title: '  Belajar Zod  ', description: '  Catatan  ' })
    ).toEqual({
      title: 'Belajar Zod',
      description: 'Catatan'
    });

    expect(toCreateTodoRequestDto({ title: 'Tanpa deskripsi', description: '   ' })).toEqual({
      title: 'Tanpa deskripsi',
      description: null
    });
  });

  test('toUpdateTodoRequestDto hanya mengirim field yang didefinisikan', () => {
    expect(toUpdateTodoRequestDto({ title: '  Judul Baru  ' })).toEqual({
      title: 'Judul Baru'
    });

    expect(toUpdateTodoRequestDto({ description: null })).toEqual({
      description: null
    });

    expect(toUpdateTodoRequestDto({ status: 'todo' })).toEqual({
      status: 'todo'
    });

    expect(toUpdateTodoRequestDto({})).toEqual({});
  });

  test('mapper melempar ApiError jika status atau tanggal tidak valid', () => {
    expect(() => toTodo(makeTodoDto({ status: 'unknown' }))).toThrow(ApiError);
    expect(() => toTodo(makeTodoDto({ createdAt: 'bukan-tanggal' }))).toThrow(ApiError);
  });
});

describe('todo.model helpers', () => {
  test('isTodoCompleted hanya benar untuk status completed', () => {
    expect(isTodoCompleted({ status: 'completed' })).toBe(true);
    expect(isTodoCompleted({ status: 'todo' })).toBe(false);
    expect(isTodoCompleted({ status: 'in_progress' })).toBe(false);
    expect(isTodoCompleted({ status: 'cancelled' })).toBe(false);
  });

  test('isTodoActive mengenali todo dan in_progress', () => {
    expect(isTodoActive({ status: 'todo' })).toBe(true);
    expect(isTodoActive({ status: 'in_progress' })).toBe(true);
    expect(isTodoActive({ status: 'completed' })).toBe(false);
    expect(isTodoActive({ status: 'cancelled' })).toBe(false);
  });

  test('isTodoCancelled hanya benar untuk cancelled', () => {
    expect(isTodoCancelled({ status: 'cancelled' })).toBe(true);
    expect(isTodoCancelled({ status: 'todo' })).toBe(false);
  });

  test('splitTodosByStatus memisahkan active dan completed tanpa memalsukan status', () => {
    const todos = [
      toTodo(makeTodoDto({ id: '1', status: 'todo' })),
      toTodo(makeTodoDto({ id: '2', status: 'in_progress' })),
      toTodo(makeTodoDto({ id: '3', status: 'completed' })),
      toTodo(makeTodoDto({ id: '4', status: 'cancelled' }))
    ];

    const result = splitTodosByStatus(todos);

    expect(result.active.map((todo) => todo.id)).toEqual(['1', '2']);
    expect(result.completed.map((todo) => todo.id)).toEqual(['3']);
  });

  test('getTodoStatusLabel memakai label Indonesia untuk seluruh enum backend', () => {
    expect(getTodoStatusLabel('todo')).toBe('Aktif');
    expect(getTodoStatusLabel('in_progress')).toBe('Dikerjakan');
    expect(getTodoStatusLabel('completed')).toBe('Selesai');
    expect(getTodoStatusLabel('cancelled')).toBe('Dibatalkan');
  });
});
