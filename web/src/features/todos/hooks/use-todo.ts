import { useQuery } from '@tanstack/react-query';
import { todoApi } from '../api/todo.api';
import { todoKeys } from '../api/todo.query-keys';
import { shouldRetryTodoQuery } from './todo-query-options';

export function useTodo(
  workspaceId: string,
  todoId: string,
  options?: { readonly enabled?: boolean }
) {
  return useQuery({
    queryKey: todoKeys.detail(workspaceId, todoId),
    queryFn: () => todoApi.getById(workspaceId, todoId),
    enabled: Boolean(workspaceId) && Boolean(todoId) && (options?.enabled ?? true),
    retry: shouldRetryTodoQuery
  });
}
