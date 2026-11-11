import type { AppNotification } from '../models/notification.model';

export type NotificationDateGroupKey = 'today' | 'yesterday' | 'earlier';

export interface NotificationDateGroup {
  readonly key: NotificationDateGroupKey;
  readonly label: string;
  readonly items: readonly AppNotification[];
}

function startOfLocalDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate(), 0, 0, 0, 0);
}

function addLocalDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}

export function getNotificationDateGroup(createdAt: Date, now: Date): NotificationDateGroupKey {
  const today = startOfLocalDay(now).getTime();
  const yesterday = startOfLocalDay(addLocalDays(now, -1)).getTime();
  const value = createdAt.getTime();

  if (value >= today) {
    return 'today';
  }

  if (value >= yesterday) {
    return 'yesterday';
  }

  return 'earlier';
}

/**
 * Grouping memakai calendar date lokal pengguna, bukan substring timestamp.
 * Urutan item di dalam group mengikuti urutan backend (createdAt DESC, id DESC).
 */
export function groupNotificationsByDate(
  notifications: readonly AppNotification[],
  now: Date
): readonly NotificationDateGroup[] {
  const buckets: Record<NotificationDateGroupKey, AppNotification[]> = {
    today: [],
    yesterday: [],
    earlier: []
  };

  for (const notification of notifications) {
    buckets[getNotificationDateGroup(notification.createdAt, now)].push(notification);
  }

  const labels: Record<NotificationDateGroupKey, string> = {
    today: 'Hari ini',
    yesterday: 'Kemarin',
    earlier: 'Sebelumnya'
  };

  return (['today', 'yesterday', 'earlier'] as const)
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, label: labels[key], items: buckets[key] }));
}
