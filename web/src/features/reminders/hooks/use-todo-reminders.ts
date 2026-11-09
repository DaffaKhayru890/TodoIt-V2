import { useQuery } from '@tanstack/react-query';
import { reminderApi, REMINDER_LIST_PAGE_SIZE } from '../api/reminder.api';
import { reminderKeys } from '../api/reminder.query-keys';
import type { ListRemindersParams } from '../models/reminder.model';

export function useTodoReminders(
  workspaceId: string,
  todoId: string,
  params?: ListRemindersParams
) {
  const effectiveParams: ListRemindersParams = {
    status: 'scheduled',
    ...params,
    limit: params?.limit ?? REMINDER_LIST_PAGE_SIZE
  };

  return useQuery({
    queryKey: reminderKeys.todoList(workspaceId, todoId, effectiveParams),
    queryFn: () => reminderApi.list(workspaceId, todoId, effectiveParams),
    enabled: Boolean(workspaceId && todoId),
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 1;
    }
  });
}
