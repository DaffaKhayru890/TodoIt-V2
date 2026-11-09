import { useQuery } from '@tanstack/react-query';
import { todoApi, TODO_LIST_PAGE_SIZE } from '../api/todo.api';
import { todoKeys } from '../api/todo.query-keys';
import type { TodayTodosParams } from '../models/todo.model';
import { shouldRetryTodoQuery } from './todo-query-options';

export function useTodayTodos(workspaceId: string, params?: TodayTodosParams) {
  const effectiveParams: TodayTodosParams = {
    ...params,
    limit: params?.limit ?? TODO_LIST_PAGE_SIZE
  };

  return useQuery({
    queryKey: todoKeys.today(workspaceId, effectiveParams),
    queryFn: () => todoApi.getToday(workspaceId, effectiveParams),
    enabled: Boolean(workspaceId),
    retry: shouldRetryTodoQuery
  });
}
