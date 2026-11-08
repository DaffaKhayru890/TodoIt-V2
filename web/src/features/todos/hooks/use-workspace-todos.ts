import { useQuery } from '@tanstack/react-query';
import { todoApi, TODO_LIST_PAGE_SIZE, type ListTodosParams } from '../api/todo.api';
import { todoKeys } from '../api/todo.query-keys';
import { shouldRetryTodoQuery } from './todo-query-options';

/**
 * Mengambil halaman pertama daftar todo workspace.
 *
 * Backend mewajibkan cursor pagination. Phase 4 sengaja hanya mengambil satu
 * halaman (maksimum 100) dan menyimpan metadata pagination agar Phase 6 dapat
 * menggantinya dengan infinite query tanpa mengubah kontrak domain.
 */
export function useWorkspaceTodos(workspaceId: string, params?: ListTodosParams) {
  const effectiveParams: ListTodosParams = {
    limit: params?.limit ?? TODO_LIST_PAGE_SIZE,
    ...(params?.cursor !== undefined ? { cursor: params.cursor } : {})
  };

  return useQuery({
    queryKey: todoKeys.workspace(workspaceId, effectiveParams),
    queryFn: () => todoApi.getByWorkspace(workspaceId, effectiveParams),
    enabled: Boolean(workspaceId),
    retry: shouldRetryTodoQuery
  });
}
