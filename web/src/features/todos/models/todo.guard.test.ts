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
