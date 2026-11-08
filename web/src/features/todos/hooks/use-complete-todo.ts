import { useMutation, useQueryClient } from '@tanstack/react-query';
import { todoApi } from '../api/todo.api';
import { todoKeys } from '../api/todo.query-keys';
import type { Todo } from '../models/todo.model';

export interface CompleteTodoVariables {
  readonly workspaceId: string;
  readonly todoId: string;
}

export function useCompleteTodo() {
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, CompleteTodoVariables>({
    mutationFn: ({ workspaceId, todoId }) => todoApi.complete(workspaceId, todoId),
    onSuccess: (updated, { workspaceId }) => {
      queryClient.setQueryData(todoKeys.detail(workspaceId, updated.id), updated);
      void queryClient.invalidateQueries({
        queryKey: todoKeys.workspaceLists(workspaceId)
      });
    }
  });
}
