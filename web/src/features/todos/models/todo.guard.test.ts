import { describe, expect, test } from 'vitest';
import { ApiError } from '@/core/errors/api-error';
import { makeTodoDto } from '@/test/fixtures/todos';
import { assertTodoListResponseDto, assertTodoResponseDto, isTodoDto } from './todo.guard';

describe('todo.guard', () => {
  test('menerima todo DTO yang sesuai kontrak backend', () => {
    expect(isTodoDto(makeTodoDto())).toBe(true);
    expect(isTodoDto(makeTodoDto({ description: null, dueAt: null, completedAt: null }))).toBe(
      true
    );
  });

  test('menolak DTO dengan status, field wajib, atau tanggal tidak valid', () => {
    expect(isTodoDto(makeTodoDto({ status: 'unknown' }))).toBe(false);
    expect(isTodoDto({ ...makeTodoDto(), title: undefined })).toBe(false);
    expect(isTodoDto(makeTodoDto({ createdAt: 'bukan-tanggal' }))).toBe(false);
    expect(isTodoDto(makeTodoDto({ tags: [{ id: 'tag-1' } as never] }))).toBe(false);
    expect(isTodoDto(null)).toBe(false);
  });

  test('assertTodoResponseDto melempar ApiError dengan kode INVALID_TODO_RESPONSE', () => {
    expect(() => assertTodoResponseDto({ todo: makeTodoDto() })).not.toThrow();

    try {
      assertTodoResponseDto({ todo: { id: 'rusak' } });
      expect.unreachable('Seharusnya melempar error');
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ code: 'INVALID_TODO_RESPONSE' });
    }
  });

  test('assertTodoListResponseDto memeriksa items dan pagination', () => {
    expect(() =>
      assertTodoListResponseDto({
        items: [makeTodoDto()],
        pagination: { limit: 20, hasMore: false, nextCursor: null }
      })
    ).not.toThrow();

    expect(() =>
      assertTodoListResponseDto({
        items: 'bukan-array',
        pagination: { limit: 20, hasMore: false, nextCursor: null }
      })
    ).toThrow(ApiError);

    expect(() =>
      assertTodoListResponseDto({
        items: [],
        pagination: { limit: '20', hasMore: false, nextCursor: null }
      })
    ).toThrow(ApiError);
  });
});

describe('todo.guard Phase 5', () => {
  test('menerima priority enum backend dan dueAt ISO/null', () => {
    for (const priority of ['low', 'medium', 'high', 'urgent']) {
      expect(isTodoDto(makeTodoDto({ priority }))).toBe(true);
    }

    expect(isTodoDto(makeTodoDto({ dueAt: '2026-11-12T02:00:00.000Z' }))).toBe(true);
    expect(isTodoDto(makeTodoDto({ dueAt: null }))).toBe(true);
  });

  test('menolak priority di luar enum backend', () => {
    expect(isTodoDto(makeTodoDto({ priority: 'critical' }))).toBe(false);
    expect(isTodoDto(makeTodoDto({ priority: '' }))).toBe(false);
  });

  test('menolak dueAt yang bukan ISO date', () => {
    expect(isTodoDto(makeTodoDto({ dueAt: '12/11/2026' }))).toBe(false);
    expect(isTodoDto(makeTodoDto({ dueAt: 123 as never }))).toBe(false);
  });

  test('menolak label dan tag yang tidak lengkap', () => {
    expect(isTodoDto(makeTodoDto({ label: { id: 'label-1', name: 'Bug' } as never }))).toBe(false);
    expect(isTodoDto(makeTodoDto({ label: { id: 'label-1', color: '#fff' } as never }))).toBe(
      false
    );
    expect(isTodoDto(makeTodoDto({ tags: [{ name: 'backend' } as never] }))).toBe(false);
    expect(isTodoDto(makeTodoDto({ tags: 'bukan-array' as never }))).toBe(false);
  });

  test('assertTodoListResponseDto menolak item dengan priority rusak', () => {
    expect(() =>
      assertTodoListResponseDto({
        items: [makeTodoDto({ priority: 'critical' })],
        pagination: { limit: 20, hasMore: false, nextCursor: null }
      })
    ).toThrow(ApiError);
  });
});
