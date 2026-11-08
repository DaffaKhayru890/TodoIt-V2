import { useMutation, useQueryClient } from '@tanstack/react-query';
import { todoApi } from '../api/todo.api';
import { todoKeys } from '../api/todo.query-keys';
import type { Todo, UpdateTodoInput } from '../models/todo.model';

export interface UpdateTodoVariables {
  readonly workspaceId: string;
  readonly todoId: string;
  readonly input: UpdateTodoInput;
}

export function useUpdateTodo() {
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, UpdateTodoVariables>({
    mutationFn: ({ workspaceId, todoId, input }) => todoApi.update(workspaceId, todoId, input),
    onSuccess: (updated, { workspaceId }) => {
      queryClient.setQueryData(todoKeys.detail(workspaceId, updated.id), updated);
      void queryClient.invalidateQueries({
        queryKey: todoKeys.workspaceLists(workspaceId)
      });
    }
  });
}
