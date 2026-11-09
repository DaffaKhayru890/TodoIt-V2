import { useMutation, useQueryClient } from '@tanstack/react-query';
import { todoKeys } from '@/features/todos/api/todo.query-keys';
import type { Todo } from '@/features/todos/models/todo.model';
import { invalidateTodoCachesForWorkspace } from '@/features/todos/utils/invalidate-todo-cache';
import { labelApi } from '../api/label.api';
import { labelKeys } from '../api/label.query-keys';
import type { CreateLabelInput, Label, UpdateLabelInput } from '../models/label.model';

export interface CreateLabelVariables {
  readonly workspaceId: string;
  readonly input: CreateLabelInput;
}

export interface UpdateLabelVariables {
  readonly workspaceId: string;
  readonly labelId: string;
  readonly input: UpdateLabelInput;
}

export interface DeleteLabelVariables {
  readonly workspaceId: string;
  readonly labelId: string;
}

export function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation<Label, Error, CreateLabelVariables>({
    mutationFn: ({ workspaceId, input }) => labelApi.create(workspaceId, input),
    onSuccess: (_label, { workspaceId }) => {
      void queryClient.invalidateQueries({ queryKey: labelKeys.workspaceLists(workspaceId) });
    }
  });
}

export function useUpdateLabel() {
  const queryClient = useQueryClient();

  return useMutation<Label, Error, UpdateLabelVariables>({
    mutationFn: ({ workspaceId, labelId, input }) => labelApi.update(workspaceId, labelId, input),
    onSuccess: (_label, { workspaceId, labelId }) => {
      void queryClient.invalidateQueries({ queryKey: labelKeys.workspaceLists(workspaceId) });
      void queryClient.invalidateQueries({ queryKey: labelKeys.detail(workspaceId, labelId) });
      invalidateTodoCachesForWorkspace(queryClient, workspaceId);
    }
  });
}

export function useDeleteLabel() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, DeleteLabelVariables>({
    mutationFn: ({ workspaceId, labelId }) => labelApi.remove(workspaceId, labelId),
    onSuccess: (_result, { workspaceId, labelId }) => {
      queryClient.removeQueries({ queryKey: labelKeys.detail(workspaceId, labelId) });
      void queryClient.invalidateQueries({ queryKey: labelKeys.workspaceLists(workspaceId) });
      invalidateTodoCachesForWorkspace(queryClient, workspaceId);
    }
  });
}

export interface AssignTodoLabelVariables {
  readonly workspaceId: string;
  readonly todoId: string;
  readonly labelId: string;
}

export function useAssignTodoLabel() {
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, AssignTodoLabelVariables>({
    mutationFn: ({ workspaceId, todoId, labelId }) =>
      labelApi.assignTodoLabel(workspaceId, todoId, labelId),
    onSuccess: (updated, { workspaceId }) => {
      queryClient.setQueryData(todoKeys.detail(workspaceId, updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: todoKeys.workspaceLists(workspaceId) });
    }
  });
}

export interface ClearTodoLabelVariables {
  readonly workspaceId: string;
  readonly todoId: string;
}

export function useClearTodoLabel() {
  const queryClient = useQueryClient();

  return useMutation<Todo, Error, ClearTodoLabelVariables>({
    mutationFn: ({ workspaceId, todoId }) => labelApi.clearTodoLabel(workspaceId, todoId),
    onSuccess: (updated, { workspaceId }) => {
      queryClient.setQueryData(todoKeys.detail(workspaceId, updated.id), updated);
      void queryClient.invalidateQueries({ queryKey: todoKeys.workspaceLists(workspaceId) });
    }
  });
}
