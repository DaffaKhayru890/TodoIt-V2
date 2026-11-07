import type { Notification } from '../entities/notification';
import type { NotificationType } from '../enums/notification-type';

export type ReadStatusFilter = 'all' | 'unread' | 'read';

export interface NotificationListQuery {
  readonly recipientUserId: string;
  readonly readStatus: ReadStatusFilter;
  readonly type: NotificationType | null;
  readonly cursor: { createdAt: Date; id: string } | null;
  readonly limit: number;
}

export interface NotificationRepository {
  insert(notification: Notification): Promise<Notification>;
  findById(id: string): Promise<Notification | null>;
  findByIdempotencyKey(key: string): Promise<Notification | null>;
  list(query: NotificationListQuery): Promise<{ items: readonly Notification[]; hasMore: boolean }>;
  countUnread(recipientUserId: string): Promise<number>;
  markRead(id: string, recipientUserId: string, readAt: Date): Promise<Notification | null>;
  markAllRead(recipientUserId: string, readAt: Date): Promise<number>;
}
