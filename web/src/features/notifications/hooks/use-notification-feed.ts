import { useQuery } from '@tanstack/react-query';
import { notificationApi } from '../api/notification.api';
import { notificationKeys } from '../api/notification.query-keys';
import {
  NOTIFICATION_FEED_LIMIT,
  NOTIFICATION_POLL_INTERVAL_MS,
  type AppNotification
} from '../models/notification.model';

function pollInterval(): number | false {
  if (typeof document !== 'undefined' && document.hidden) {
    return false;
  }

  return NOTIFICATION_POLL_INTERVAL_MS;
}

/**
 * Feed notifikasi belum dibaca untuk deteksi notifikasi baru. Endpoint daftar
 * notifikasi adalah satu-satunya sumber data; tidak ada WebSocket/SSE/push.
 */
export function useNotificationFeed(enabled = true) {
  return useQuery({
    queryKey: notificationKeys.feed(),
    queryFn: () =>
      notificationApi.getList({ readStatus: 'unread', limit: NOTIFICATION_FEED_LIMIT }),
    select: (result): readonly AppNotification[] => result.items,
    enabled,
    refetchInterval: pollInterval,
    retry: (failureCount, error) => {
      if (error instanceof Error && 'status' in error && error.status === 401) {
        return false;
      }

      return failureCount < 1;
    }
  });
}
