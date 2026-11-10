import type { ListNotificationsParams } from '../models/notification.model';

export type NotificationListScope = Omit<ListNotificationsParams, 'cursor'>;

export const notificationKeys = {
  all: ['notifications'] as const,

  lists: () => [...notificationKeys.all, 'list'] as const,

  list: (params?: NotificationListScope) =>
    [...notificationKeys.lists(), params ?? {}] as const,

  feed: () => [...notificationKeys.all, 'feed'] as const,

  unreadCount: () => [...notificationKeys.all, 'unread-count'] as const,

  preferences: () => [...notificationKeys.all, 'preferences'] as const
};
