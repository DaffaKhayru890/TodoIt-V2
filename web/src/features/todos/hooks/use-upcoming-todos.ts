import { useQuery } from '@tanstack/react-query';
import { todoApi, TODO_LIST_PAGE_SIZE } from '../api/todo.api';
import { todoKeys } from '../api/todo.query-keys';
import type { UpcomingTodosParams } from '../models/todo.model';
import { shouldRetryTodoQuery } from './todo-query-options';

export function useUpcomingTodos(workspaceId: string, params?: UpcomingTodosParams) {
  const effectiveParams: UpcomingTodosParams = {
    ...params,
    limit: params?.limit ?? TODO_LIST_PAGE_SIZE
  };

  return useQuery({
    queryKey: todoKeys.upcoming(workspaceId, effectiveParams),
    queryFn: () => todoApi.getUpcoming(workspaceId, effectiveParams),
    enabled: Boolean(workspaceId),
    retry: shouldRetryTodoQuery
  });
}
