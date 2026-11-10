import { useCallback, useState } from 'react';
import {
  addRecentSearch,
  recentSearchStorage,
  removeRecentSearch
} from '../utils/recent-searches';

export interface RecentSearchesController {
  readonly items: readonly string[];
  addSearch(query: string): void;
  removeSearch(query: string): void;
  clearSearches(): void;
}

/**
 * Recent search hanya disimpan di localStorage perangkat ini. Tidak ada
 * endpoint search history di backend, sehingga data tidak pernah dikirim ke
 * server dan tidak dicampur dengan cache TanStack Query.
 */
export function useRecentSearches(): RecentSearchesController {
  const [items, setItems] = useState<readonly string[]>(() => recentSearchStorage.read());

  const persist = useCallback((next: readonly string[]) => {
    setItems(next);
    recentSearchStorage.write(next);
  }, []);

  const addSearch = useCallback(
    (query: string) => {
      setItems((current) => {
        const next = addRecentSearch(current, query);
        recentSearchStorage.write(next);
        return next;
      });
    },
    []
  );

  const removeSearch = useCallback((query: string) => {
    setItems((current) => {
      const next = removeRecentSearch(current, query);
      recentSearchStorage.write(next);
      return next;
    });
  }, []);

  const clearSearches = useCallback(() => {
    persist([]);
  }, [persist]);

  return { items, addSearch, removeSearch, clearSearches };
}
