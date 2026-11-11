import { describe, expect, test, vi } from 'vitest';
import { EMPTY_TODO_FILTER } from '../models/todo-filter';
import type { TodoListResult } from '../models/todo.model';
import { toTodo } from '../models/todo.mapper';
import { flattenTodoPages } from './flatten-todo-pages';
import { buildWorkspaceScrollKey } from './workspace-scroll-key';
import { makeTodoDto } from '@/test/fixtures/todos';
import type { ScrollStorage } from '@/hooks/scroll-position-storage';
import {
  clearScrollPosition,
  readScrollPosition,
  writeScrollPosition
} from '@/hooks/scroll-position-storage';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const otherWorkspaceId = '22222222-2222-4222-8222-222222222222';

function page(items: readonly ReturnType<typeof makeTodoDto>[]): TodoListResult {
  return {
    items: items.map(toTodo),
    pagination: { limit: 30, hasMore: false, nextCursor: null }
  };
}

function memoryStorage(initial: Record<string, string> = {}) {
  const state = new Map(Object.entries(initial));

  return {
    get size() {
      return state.size;
    },
    getItem: (key: string) => state.get(key) ?? null,
    setItem: (key: string, value: string) => {
      state.set(key, value);
    },
    removeItem: (key: string) => {
      state.delete(key);
    }
  } satisfies ScrollStorage & { readonly size: number };
}

describe('flattenTodoPages', () => {
  test('menggabungkan halaman sesuai urutan dan membuang duplikat', () => {
    const first = makeTodoDto({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' });
    const second = makeTodoDto({ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' });

    const result = flattenTodoPages(workspaceId, [page([first, second]), page([second])]);

    expect(result.map((todo) => todo.id)).toEqual([first.id, second.id]);
  });

  test('membuang item dari workspace lain sebagai pertahanan cache', () => {
    const result = flattenTodoPages(workspaceId, [
      page([
        makeTodoDto({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }),
        makeTodoDto({
          id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
          workspaceId: otherWorkspaceId
        })
      ])
    ]);

    expect(result).toHaveLength(1);
    expect(result[0]?.workspaceId).toBe(workspaceId);
  });

  test('menangani pages undefined', () => {
    expect(flattenTodoPages(workspaceId, undefined)).toEqual([]);
  });
});

describe('buildWorkspaceScrollKey', () => {
  test('membedakan workspace, sorting, dan filter', () => {
    const filter = { ...EMPTY_TODO_FILTER, status: 'active' as const, priority: 'high' as const };
    const sort = { field: 'title', direction: 'asc' } as const;

    const base = buildWorkspaceScrollKey(workspaceId, filter, sort);

    expect(base).toBe(
      buildWorkspaceScrollKey(
        workspaceId,
        { ...EMPTY_TODO_FILTER, status: 'active', priority: 'high' },
        sort
      )
    );
    expect(base).not.toBe(buildWorkspaceScrollKey(otherWorkspaceId, filter, sort));
    expect(base).not.toBe(
      buildWorkspaceScrollKey(workspaceId, filter, { field: 'dueDate', direction: 'asc' })
    );
    expect(base).not.toBe(
      buildWorkspaceScrollKey(workspaceId, { ...EMPTY_TODO_FILTER, status: 'active' }, sort)
    );
  });
});

describe('scroll position storage', () => {
  test('menyimpan dan membaca posisi angka', () => {
    const storage = memoryStorage();

    writeScrollPosition('scroll-key', 120.6, storage);

    expect(readScrollPosition('scroll-key', storage)).toBe(121);
  });

  test('nilai rusak, negatif, dan tidak ada dikembalikan sebagai nol', () => {
    expect(readScrollPosition('missing', memoryStorage())).toBe(0);
    expect(readScrollPosition('rusak', memoryStorage({ rusak: 'abc' }))).toBe(0);
    expect(readScrollPosition('negatif', memoryStorage({ negatif: '-10' }))).toBe(0);
  });

  test('posisi dapat dihapus', () => {
    const storage = memoryStorage({ key: '10' });

    clearScrollPosition('key', storage);

    expect(readScrollPosition('key', storage)).toBe(0);
    expect(storage.size).toBe(0);
  });

  test('storage null dan storage yang melempar error diabaikan', () => {
    expect(readScrollPosition('key', null)).toBe(0);
    expect(() => writeScrollPosition('key', 10, null)).not.toThrow();
    expect(() => clearScrollPosition('key', null)).not.toThrow();

    const broken: ScrollStorage = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(() => {
        throw new Error('quota');
      }),
      removeItem: vi.fn(() => {
        throw new Error('blocked');
      })
    };

    expect(readScrollPosition('key', broken)).toBe(0);
    expect(() => writeScrollPosition('key', 10, broken)).not.toThrow();
    expect(() => clearScrollPosition('key', broken)).not.toThrow();
  });
});
