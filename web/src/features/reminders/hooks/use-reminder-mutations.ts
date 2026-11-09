import { useMutation, useQueryClient } from '@tanstack/react-query';
import { todoKeys } from '@/features/todos/api/todo.query-keys';
import { reminderApi } from '../api/reminder.api';
import { reminderKeys } from '../api/reminder.query-keys';
import type { CreateReminderInput, Reminder, UpdateReminderInput } from '../models/reminder.model';

export interface CreateReminderVariables {
  readonly workspaceId: string;
  readonly todoId: string;
  readonly input: CreateReminderInput;
}

export interface UpdateReminderVariables {
  readonly workspaceId: string;
  readonly todoId: string;
  readonly reminderId: string;
  readonly input: UpdateReminderInput;
}

export interface CancelReminderVariables {
  readonly workspaceId: string;
  readonly todoId: string;
  readonly reminderId: string;
}

function invalidateForTodo(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  todoId: string
): void {
  void queryClient.invalidateQueries({ queryKey: reminderKeys.todoLists(workspaceId, todoId) });
  void queryClient.invalidateQueries({ queryKey: todoKeys.detail(workspaceId, todoId) });
  void queryClient.invalidateQueries({ queryKey: todoKeys.workspaceLists(workspaceId) });
}

export function useCreateReminder() {
  const queryClient = useQueryClient();

  return useMutation<Reminder, Error, CreateReminderVariables>({
    mutationFn: ({ workspaceId, todoId, input }) => reminderApi.create(workspaceId, todoId, input),
    onSuccess: (reminder, { workspaceId, todoId }) => {
      queryClient.setQueryData(reminderKeys.detail(workspaceId, todoId, reminder.id), reminder);
      invalidateForTodo(queryClient, workspaceId, todoId);
    }
  });
}

export function useUpdateReminder() {
  const queryClient = useQueryClient();

  return useMutation<Reminder, Error, UpdateReminderVariables>({
    mutationFn: ({ workspaceId, todoId, reminderId, input }) =>
      reminderApi.update(workspaceId, todoId, reminderId, input),
    onSuccess: (reminder, { workspaceId, todoId }) => {
      queryClient.setQueryData(reminderKeys.detail(workspaceId, todoId, reminder.id), reminder);
      invalidateForTodo(queryClient, workspaceId, todoId);
    }
  });
}

export function useCancelReminder() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, CancelReminderVariables>({
    mutationFn: ({ workspaceId, todoId, reminderId }) =>
      reminderApi.cancel(workspaceId, todoId, reminderId),
    onSuccess: (_result, { workspaceId, todoId, reminderId }) => {
      queryClient.removeQueries({
        queryKey: reminderKeys.detail(workspaceId, todoId, reminderId)
      });
      invalidateForTodo(queryClient, workspaceId, todoId);
    }
  });
}
