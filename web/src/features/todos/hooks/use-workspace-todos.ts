import { useQuery } from '@tanstack/react-query';
import { todoApi, TODO_LIST_PAGE_SIZE } from '../api/todo.api';
import { todoKeys } from '../api/todo.query-keys';
import type { TodoListParams } from '../models/todo.model';
import { shouldRetryTodoQuery } from './todo-query-options';

/**
 * Mengambil halaman pertama daftar todo workspace dengan filter server-side.
 *
 * Backend mewajibkan cursor pagination. Phase 5 sengaja hanya mengambil satu
 * halaman (maksimum 100) dan menyimpan metadata pagination agar Phase 6 dapat
 * menggantinya dengan infinite query tanpa mengubah kontrak domain.
 */
export function useWorkspaceTodos(workspaceId: string, params?: TodoListParams) {
  const effectiveParams: TodoListParams = {
    ...params,
    limit: params?.limit ?? TODO_LIST_PAGE_SIZE
  };

  return useQuery({
    queryKey: todoKeys.workspace(workspaceId, effectiveParams),
    queryFn: () => todoApi.getByWorkspace(workspaceId, effectiveParams),
    enabled: Boolean(workspaceId),
    retry: shouldRetryTodoQuery
  });
}
