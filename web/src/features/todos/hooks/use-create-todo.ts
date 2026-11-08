import { useMutation, useQueryClient } from '@tanstack/react-query';
import { todoApi } from '../api/todo.api';
import { todoKeys } from '../api/todo.query-keys';
import type { CreateTodoInput, Todo } from '../models/todo.model';

export interface CreateTodoVariables {
  readonly workspaceId: string;
  readonly input: CreateTodoInput;
}

export function useCreateTodo() {
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, CreateTodoVariables>({
    mutationFn: ({ workspaceId, input }) => todoApi.create(workspaceId, input),
    onSuccess: (created, { workspaceId }) => {
      queryClient.setQueryData(todoKeys.detail(workspaceId, created.id), created);
      void queryClient.invalidateQueries({
        queryKey: todoKeys.workspaceLists(workspaceId)
      });
    }
  });
}
