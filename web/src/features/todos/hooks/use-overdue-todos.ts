import { useQuery } from '@tanstack/react-query';
import { todoApi, TODO_LIST_PAGE_SIZE } from '../api/todo.api';
import { todoKeys } from '../api/todo.query-keys';
import type { OverdueTodosParams } from '../models/todo.model';
import { shouldRetryTodoQuery } from './todo-query-options';

export function useOverdueTodos(workspaceId: string, params?: OverdueTodosParams) {
  const effectiveParams: OverdueTodosParams = {
    ...params,
    limit: params?.limit ?? TODO_LIST_PAGE_SIZE
  };

  return useQuery({
    queryKey: todoKeys.overdue(workspaceId, effectiveParams),
    queryFn: () => todoApi.getOverdue(workspaceId, effectiveParams),
    enabled: Boolean(workspaceId),
    retry: shouldRetryTodoQuery
  });
}
