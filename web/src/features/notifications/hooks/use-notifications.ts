import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData
} from '@tanstack/react-query';
import { ApiError } from '@/core/errors/api-error';
import { notificationApi } from '../api/notification.api';
import { notificationKeys } from '../api/notification.query-keys';
import {
  NOTIFICATION_PAGE_SIZE,
  NOTIFICATION_POLL_INTERVAL_MS,
  type ListNotificationsParams,
  type NotificationListResult,
  type NotificationReadStatus
} from '../models/notification.model';

export interface UseNotificationsOptions {
  readonly readStatus?: NotificationReadStatus;
  readonly type?: ListNotificationsParams['type'];
  readonly enabled?: boolean;
}

function shouldRetryNotificationQuery(failureCount: number, error: Error): boolean {
  if (
    error instanceof ApiError &&
    (error.status === 401 || error.status === 403 || error.status === 404)
  ) {
    return false;
  }

  return failureCount < 1;
}

function pollInterval(): number | false {
  if (typeof document !== 'undefined' && document.hidden) {
    return false;
  }

  return NOTIFICATION_POLL_INTERVAL_MS;
}

/** Paginated notification list. Cursor berasal dari response backend. */
export function useNotifications(options: UseNotificationsOptions = {}) {
  const readStatus = options.readStatus ?? 'all';
  const type = options.type;

  return useInfiniteQuery({
    queryKey: notificationKeys.list({
      limit: NOTIFICATION_PAGE_SIZE,
      readStatus,
      ...(type ? { type } : {})
    }),
    queryFn: ({ pageParam, signal }) =>
      notificationApi.getList(
        {
          limit: NOTIFICATION_PAGE_SIZE,
          readStatus,
          ...(type ? { type } : {}),
          ...(pageParam ? { cursor: pageParam } : {})
        },
        { signal }
      ),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) =>
      lastPage.pagination.hasMore ? (lastPage.pagination.nextCursor ?? undefined) : undefined,
    enabled: options.enabled ?? true,
    retry: shouldRetryNotificationQuery,
    refetchInterval: (query) => (query.state.status === 'error' ? false : pollInterval())
  });
}

/** Unread count adalah endpoint terpisah; nilainya tidak dihitung dari page. */
export function useUnreadNotificationCount(options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: notificationKeys.unreadCount(),
    queryFn: () => notificationApi.getUnreadCount(),
    enabled: options.enabled ?? true,
    retry: shouldRetryNotificationQuery,
    refetchInterval: pollInterval,
    refetchOnWindowFocus: true
  });
}

export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationApi.markRead(notificationId),
    onSuccess: (updated) => {
      queryClient.setQueriesData<InfiniteData<NotificationListResult, string | undefined>>(
        { queryKey: notificationKeys.lists() },
        (data) => {
          if (!data) {
            return data;
          }

          return {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.map((item) => (item.id === updated.id ? updated : item))
            }))
          };
        }
      );

      void queryClient.invalidateQueries({ queryKey: notificationKeys.feed() });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    }
  });
}

export function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: () => {
      queryClient.setQueryData(notificationKeys.unreadCount(), 0);
      void queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.feed() });
      void queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
    }
  });
}
