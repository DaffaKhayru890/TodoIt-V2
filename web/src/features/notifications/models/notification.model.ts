export const NOTIFICATION_TYPES = ['reminder_due', 'todo_due_soon'] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationReadStatus = 'all' | 'unread' | 'read';

export interface NotificationData {
  readonly todoId?: string;
  readonly workspaceId?: string;
  readonly reminderId?: string;
  readonly dueAt?: string;
  readonly offsetMinutes?: number;
  readonly effectiveAt?: string;
}

export interface AppNotification {
  readonly id: string;
  readonly type: NotificationType;
  readonly title: string;
  readonly body: string;
  readonly data: NotificationData;
  readonly readAt: Date | null;
  readonly createdAt: Date;
}

export interface NotificationPagination {
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface NotificationListResult {
  readonly items: readonly AppNotification[];
  readonly pagination: NotificationPagination;
}

export interface NotificationPreferences {
  readonly inAppEnabled: true;
  readonly emailEnabled: boolean;
}

export interface ListNotificationsParams {
  readonly limit?: number;
  readonly cursor?: string;
  readonly readStatus?: NotificationReadStatus;
  readonly type?: NotificationType;
}

export const NOTIFICATION_PAGE_SIZE = 20;
export const NOTIFICATION_POLL_INTERVAL_MS = 60_000;
export const NOTIFICATION_FEED_LIMIT = 20;

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}

export function isNotificationReadStatus(value: string): value is NotificationReadStatus {
  return value === 'all' || value === 'unread' || value === 'read';
}

export function isNotificationUnread(notification: Pick<AppNotification, 'readAt'>): boolean {
  return notification.readAt === null;
}
