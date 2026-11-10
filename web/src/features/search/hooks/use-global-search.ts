import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/core/errors/api-error';
import { searchApi } from '../api/search.api';
import { searchKeys } from '../api/search.query-keys';
import {
  SEARCH_DEBOUNCE_MS,
  isSearchableQuery,
  normalizeSearchQuery,
  type SearchWorkspace
} from '../models/search.model';
import { useDebouncedValue } from '../utils/debounce';
import { useSearchWorkspaces } from './use-search-workspaces';

function shouldRetrySearchQuery(failureCount: number, error: Error): boolean {
  if (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403 || error.status === 404)
  ) {
    return false;
  }

  return failureCount < 1;
}

/**
 * Query pencarian global.
 *
 * Query mentah didebounce, lalu baru dijalankan bila sudah memenuhi panjang
 * minimum. TanStack Query meneruskan AbortSignal ke `searchApi`, sehingga
 * perubahan query otomatis membatalkan fan-out request sebelumnya.
 */
export function useGlobalSearch(rawQuery: string, providedWorkspaces?: readonly SearchWorkspace[]) {
  const normalized = normalizeSearchQuery(rawQuery);
  const debouncedQuery = useDebouncedValue(normalized, SEARCH_DEBOUNCE_MS);
  const workspacesQuery = useSearchWorkspaces();
  const workspaces = providedWorkspaces ?? workspacesQuery.data ?? [];
  const workspaceIds = workspaces.map((workspace) => workspace.id);
  const enabled = isSearchableQuery(debouncedQuery) && workspaces.length > 0;

  const searchQuery = useQuery({
    queryKey: searchKeys.results({ query: debouncedQuery, workspaceIds }),
    queryFn: ({ signal }) =>
      searchApi.search({
        query: debouncedQuery,
        workspaces,
        signal
      }),
    enabled,
    retry: shouldRetrySearchQuery,
    staleTime: 30_000
  });

  return {
    normalizedQuery: normalized,
    debouncedQuery,
    isDebouncing: normalized !== debouncedQuery,
    isQueryTooShort: !isSearchableQuery(normalized),
    workspaces,
    workspacesQuery,
    searchQuery
  };
}
