import { useMutation, useQueryClient } from '@tanstack/react-query';
import { todoApi } from '../api/todo.api';
import { todoKeys } from '../api/todo.query-keys';
import type { Todo } from '../models/todo.model';

export interface ReopenTodoVariables {
  readonly workspaceId: string;
  readonly todoId: string;
}

/**
 * Backend tidak memiliki endpoint reopen khusus. Reopen memakai PATCH status
 * `todo`, yang juga mengosongkan completedAt di sisi server.
 */
export function useReopenTodo() {
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, ReopenTodoVariables>({
    mutationFn: ({ workspaceId, todoId }) =>
      todoApi.update(workspaceId, todoId, { status: 'todo' }),
    onSuccess: (updated, { workspaceId }) => {
      queryClient.setQueryData(todoKeys.detail(workspaceId, updated.id), updated);
      void queryClient.invalidateQueries({
        queryKey: todoKeys.workspaceLists(workspaceId)
      });
    }
  });
}
