import type { QueryClient } from '@tanstack/react-query';
import { todoKeys } from '../api/todo.query-keys';

/**
 * Invalidasi seluruh daftar/view todo dan detail pada satu workspace saja.
 * Dipakai ketika metadata workspace (tag/label) berubah dan nama metadata
 * yang tertanam pada cache todo perlu dimuat ulang.
 */
export function invalidateTodoCachesForWorkspace(
  queryClient: QueryClient,
  workspaceId: string
): void {
  void queryClient.invalidateQueries({
    queryKey: todoKeys.workspaceLists(workspaceId)
  });

  void queryClient.invalidateQueries({
    queryKey: todoKeys.details(),
    predicate: (query) => query.queryKey[2] === workspaceId
  });
}
