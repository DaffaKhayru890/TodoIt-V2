import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/components/ui/toast/use-toast';
import { notificationKeys } from '../api/notification.query-keys';
import { getNotificationTarget } from '../utils/notification-navigation';
import { useBrowserNotifications } from './use-browser-notifications';
import { useNotificationFeed } from './use-notification-feed';

function isDocumentHidden(): boolean {
  return typeof document !== 'undefined' && document.hidden;
}

/**
 * Deteksi notifikasi baru melalui polling feed unread.
 *
 * Polling pertama hanya menjadi baseline: notifikasi lama yang belum dibaca
 * tidak memicu toast/browser notification. Setelah baseline, ID backend dipakai
 * sebagai identity agar refetch, reconnect, atau render ulang tidak
 * menampilkan notifikasi yang sama dua kali.
 */
export function useNotificationUpdates(enabled = true): void {
  const feed = useNotificationFeed(enabled);
  const { showToast } = useToast();
  const browser = useBrowserNotifications();
  const queryClient = useQueryClient();
  const seenIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!feed.data) {
      return;
    }

    if (seenIds.current === null) {
      seenIds.current = new Set(feed.data.map((notification) => notification.id));
      return;
    }

    const seen = seenIds.current;
    const fresh = feed.data.filter((notification) => !seen.has(notification.id));

    if (fresh.length === 0) {
      return;
    }

    for (const notification of fresh) {
      seen.add(notification.id);
    }

    const newestFirst = [...fresh].reverse();

    for (const notification of newestFirst) {
      const hidden = isDocumentHidden();

      if (!hidden) {
        showToast({
          title: notification.title,
          description: notification.body,
          tone: notification.type === 'reminder_due' ? 'danger' : 'warning'
        });
      } else {
        const href = getNotificationTarget(notification);

        browser.showNotification({
          id: notification.id,
          title: notification.title,
          body: notification.body,
          ...(href ? { href } : {})
        });
      }
    }

    void queryClient.invalidateQueries({ queryKey: notificationKeys.lists() });
    void queryClient.invalidateQueries({ queryKey: notificationKeys.unreadCount() });
  }, [browser, feed.data, queryClient, showToast]);
}
