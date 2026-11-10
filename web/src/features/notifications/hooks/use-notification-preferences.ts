import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError } from '@/core/errors/api-error';
import { notificationApi } from '../api/notification.api';
import { notificationKeys } from '../api/notification.query-keys';
import type { NotificationPreferences } from '../models/notification.model';

function shouldRetry(failureCount: number, error: Error): boolean {
  if (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403 || error.status === 404)
  ) {
    return false;
  }

  return failureCount < 1;
}

export function useNotificationPreferences() {
  return useQuery({
    queryKey: notificationKeys.preferences(),
    queryFn: () => notificationApi.getPreferences(),
    retry: shouldRetry
  });
}

export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (emailEnabled: boolean) => notificationApi.updatePreferences({ emailEnabled }),
    onSuccess: (preferences) => {
      queryClient.setQueryData<NotificationPreferences>(
        notificationKeys.preferences(),
        preferences
      );
    }
  });
}
