import { useMutation, useQueryClient } from '@tanstack/react-query';
import { todoApi } from '../api/todo.api';
import { todoKeys } from '../api/todo.query-keys';

export interface DeleteTodoVariables {
  readonly workspaceId: string;
  readonly todoId: string;
}

export function useDeleteTodo() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteTodoVariables>({
    mutationFn: ({ workspaceId, todoId }) => todoApi.remove(workspaceId, todoId),
    onSuccess: (_result, { workspaceId, todoId }) => {
      queryClient.removeQueries({
        queryKey: todoKeys.detail(workspaceId, todoId)
      });
      void queryClient.invalidateQueries({
        queryKey: todoKeys.workspaceLists(workspaceId)
      });
    }
  });
}
