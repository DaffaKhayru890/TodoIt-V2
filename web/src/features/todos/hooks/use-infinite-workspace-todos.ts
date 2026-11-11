import { useInfiniteQuery } from '@tanstack/react-query';
import { todoApi, type TodoRequestOptions } from '../api/todo.api';
import { todoKeys, type TodoInfiniteScope } from '../api/todo.query-keys';
import type { TodoListParams } from '../models/todo.model';
import { shouldRetryTodoQuery } from './todo-query-options';

/**
 * Ukuran halaman infinite scroll. Backend mengizinkan hingga 100, tetapi 30
 * menjaga payload tetap ringan dan membuat sentinel terpicu secara wajar.
 */
export const TODO_INFINITE_PAGE_SIZE = 30;

export interface UseInfiniteWorkspaceTodosOptions {
  readonly sort?: TodoInfiniteScope['sort'];
}

function withoutCursor(params: TodoListParams | undefined): Omit<TodoListParams, 'cursor'> {
  if (!params) {
    return {};
  }

  const { cursor, ...rest } = params;
  void cursor;
  return rest;
}

/**
 * Daftar todo workspace dengan cursor pagination backend.
 *
 * Cursor selalu berasal dari `pagination.nextCursor`; frontend tidak pernah
 * membangun cursor sendiri. `sort` hanya menjadi bagian query key (client-side
 * sorting) agar perubahan sorting memulai pagination dari halaman pertama.
 */
export function useInfiniteWorkspaceTodos(
  workspaceId: string,
  params?: TodoListParams,
  options: UseInfiniteWorkspaceTodosOptions = {}
) {
  const baseParams = withoutCursor(params);
  const effectiveParams: TodoListParams = {
    ...baseParams,
    limit: baseParams.limit ?? TODO_INFINITE_PAGE_SIZE
  };
  const scope: TodoInfiniteScope = {
    params: effectiveParams,
    ...(options.sort ? { sort: options.sort } : {})
  };

  return useInfiniteQuery({
    queryKey: todoKeys.workspaceInfinite(workspaceId, scope),
    queryFn: ({ pageParam, signal }) =>
      todoApi.getByWorkspace(
        workspaceId,
        {
          ...effectiveParams,
          ...(pageParam ? { cursor: pageParam } : {})
        },
        { signal } satisfies TodoRequestOptions
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? (lastPage.pagination.nextCursor ?? undefined) : undefined,
    enabled: Boolean(workspaceId),
    retry: shouldRetryTodoQuery,
    staleTime: 30_000
  });
}
