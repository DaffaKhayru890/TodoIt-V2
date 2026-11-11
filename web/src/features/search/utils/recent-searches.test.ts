import { describe, expect, test, vi } from 'vitest';
import {
  SEARCH_MAX_QUERY_LENGTH,
  SEARCH_RECENT_LIMIT,
  SEARCH_RECENT_STORAGE_KEY,
  type RecentSearchStorage
} from '../models/search.model';
import {
  addRecentSearch,
  parseRecentSearches,
  persistRecentSearches,
  readRecentSearches,
  removeRecentSearch
} from './recent-searches';

function memoryStorage(initial?: string): RecentSearchStorage & { value: string | null } {
  const state = { value: initial ?? null };

  return {
    get value() {
      return state.value;
    },
    getItem: () => state.value,
    setItem: (_key, value) => {
      state.value = value;
    },
    removeItem: () => {
      state.value = null;
    }
  };
}

describe('recent searches', () => {
  test('menambahkan query terbaru di depan dan menormalkan spasi', () => {
    expect(addRecentSearch([], '  backend   integration  ')).toEqual(['backend integration']);
  });

  test('duplikat case-insensitive diganti versi terbaru tanpa duplikasi', () => {
    const items = addRecentSearch(['Backend', 'design'], 'backend');

    expect(items).toEqual(['backend', 'design']);
  });

  test('membatasi jumlah item sesuai konfigurasi', () => {
    let items: readonly string[] = [];

    for (let index = 0; index < SEARCH_RECENT_LIMIT + 3; index += 1) {
      items = addRecentSearch(items, `query ${index}`);
    }

    expect(items).toHaveLength(SEARCH_RECENT_LIMIT);
    expect(items[0]).toBe(`query ${SEARCH_RECENT_LIMIT + 2}`);
  });

  test('query kosong tidak menambah item', () => {
    expect(addRecentSearch(['backend'], '   ')).toEqual(['backend']);
  });

  test('remove menghapus case-insensitively', () => {
    expect(removeRecentSearch(['Backend', 'design'], 'backend')).toEqual(['design']);
  });

  test('parse menolak JSON rusak dan bentuk yang bukan array', () => {
    expect(parseRecentSearches('{rusak')).toEqual([]);
    expect(parseRecentSearches('"bukan array"')).toEqual([]);
  });

  test('parse membuang entri invalid, duplikat, dan kosong', () => {
    const raw = JSON.stringify(['Backend', 'backend', '', 42, '   ', 'design']);

    expect(parseRecentSearches(raw)).toEqual(['Backend', 'design']);
  });

  test('parse memotong entri yang melebihi panjang maksimum query', () => {
    const raw = JSON.stringify(['x'.repeat(500)]);

    const [entry] = parseRecentSearches(raw);

    expect(entry).toHaveLength(SEARCH_MAX_QUERY_LENGTH);
  });

  test('read mengembalikan array kosong ketika storage melempar error', () => {
    const storage: RecentSearchStorage = {
      getItem: vi.fn(() => {
        throw new Error('blocked');
      }),
      setItem: vi.fn(),
      removeItem: vi.fn()
    };

    expect(readRecentSearches(storage)).toEqual([]);
  });

  test('persist tidak melempar ketika storage penuh', () => {
    const storage: RecentSearchStorage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
      removeItem: () => undefined
    };

    expect(() => persistRecentSearches(['backend'], storage)).not.toThrow();
  });

  test('persist menghapus key ketika daftar kosong', () => {
    const storage = memoryStorage(JSON.stringify(['backend']));

    persistRecentSearches([], storage);

    expect(storage.value).toBeNull();
  });

  test('persist menulis key yang terdokumentasi', () => {
    const storage = memoryStorage();

    persistRecentSearches(['backend'], storage);

    expect(storage.value).toBe(JSON.stringify(['backend']));
    expect(SEARCH_RECENT_STORAGE_KEY).toBe('todoit.search.recent.v1');
  });

  test('storage null diabaikan dengan aman', () => {
    expect(readRecentSearches(null)).toEqual([]);
    expect(() => persistRecentSearches(['backend'], null)).not.toThrow();
  });
});
