import {
  SEARCH_MAX_QUERY_LENGTH,
  SEARCH_RECENT_LIMIT,
  SEARCH_RECENT_STORAGE_KEY,
  normalizeSearchQuery,
  type RecentSearchStorage
} from '../models/search.model';

function resolveStorage(): RecentSearchStorage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/** Membaca storage secara defensif; data rusak tidak boleh mematahkan aplikasi. */
export function parseRecentSearches(raw: string | null): readonly string[] {
  if (!raw) {
    return [];
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) {
    return [];
  }

  const result: string[] = [];
  const seen = new Set<string>();

  for (const value of parsed) {
    if (typeof value !== 'string') {
      continue;
    }

    const normalized = normalizeSearchQuery(value);

    if (normalized.length === 0 || normalized.length > SEARCH_MAX_QUERY_LENGTH) {
      continue;
    }

    const key = normalized.toLocaleLowerCase('id-ID');

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);

    if (result.length === SEARCH_RECENT_LIMIT) {
      break;
    }
  }

  return result;
}

export function readRecentSearches(storage: RecentSearchStorage | null): readonly string[] {
  if (!storage) {
    return [];
  }

  try {
    return parseRecentSearches(storage.getItem(SEARCH_RECENT_STORAGE_KEY));
  } catch {
    return [];
  }
}

export function persistRecentSearches(
  items: readonly string[],
  storage: RecentSearchStorage | null
): void {
  if (!storage) {
    return;
  }

  try {
    if (items.length === 0) {
      storage.removeItem(SEARCH_RECENT_STORAGE_KEY);
      return;
    }

    storage.setItem(SEARCH_RECENT_STORAGE_KEY, JSON.stringify(items));
  } catch {
    // Quota penuh atau storage diblokir bukan alasan untuk menghentikan search.
  }
}

/** Query terbaru selalu di depan; duplikat case-insensitive diganti versi terbaru. */
export function addRecentSearch(
  items: readonly string[],
  query: string
): readonly string[] {
  const normalized = normalizeSearchQuery(query);

  if (!normalized) {
    return items;
  }

  const key = normalized.toLocaleLowerCase('id-ID');
  const rest = items.filter((item) => item.toLocaleLowerCase('id-ID') !== key);

  return [normalized, ...rest].slice(0, SEARCH_RECENT_LIMIT);
}

export function removeRecentSearch(items: readonly string[], query: string): readonly string[] {
  const key = normalizeSearchQuery(query).toLocaleLowerCase('id-ID');
  return items.filter((item) => item.toLocaleLowerCase('id-ID') !== key);
}

export const recentSearchStorage = {
  read: (): readonly string[] => readRecentSearches(resolveStorage()),
  write: (items: readonly string[]): void => persistRecentSearches(items, resolveStorage())
};
