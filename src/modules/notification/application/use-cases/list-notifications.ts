import { isNotificationType } from '../../domain/enums/notification-type';
import { NotificationError } from '../../domain/errors/notification-error';
import type { ReadStatusFilter } from '../../domain/repositories/notification.repository';
import type { NotificationRepository } from '../../domain/repositories/notification.repository';
import type { NotificationCursorCodec } from '../ports/notification-cursor';

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

export class ListNotifications {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly cursors: NotificationCursorCodec
  ) {}

  async execute(input: {
    userId: string;
    limit?: number;
    cursor?: string;
    readStatus?: string;
    type?: string;
  }) {
    const limit = input.limit ?? DEFAULT_LIMIT;

    if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
      throw NotificationError.validation(`Limit harus bilangan bulat antara 1 dan ${MAX_LIMIT}.`);
    }

    const readStatus = (input.readStatus ?? 'all') as ReadStatusFilter;

    if (readStatus !== 'all' && readStatus !== 'unread' && readStatus !== 'read') {
      throw NotificationError.validation('readStatus harus all, unread, atau read.');
    }

    if (input.type !== undefined && !isNotificationType(input.type)) {
      throw NotificationError.validation('Jenis notifikasi tidak valid.');
    }

    const filter = { readStatus, type: input.type && isNotificationType(input.type) ? input.type : null };
    const fingerprint = this.cursors.fingerprint(filter);
    const cursor = input.cursor ? this.cursors.decode(input.cursor, fingerprint) : null;
    const result = await this.notifications.list({
      recipientUserId: input.userId,
      readStatus,
      type: filter.type,
      cursor,
      limit
    });
    const last = result.items[result.items.length - 1];

    return {
      items: result.items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        body: item.body,
        data: item.data,
        readAt: item.readAt,
        createdAt: item.createdAt
      })),
      pagination: {
        limit,
        hasMore: result.hasMore,
        nextCursor:
          result.hasMore && last
            ? this.cursors.encode({ createdAt: last.createdAt, id: last.id, fingerprint })
            : null
      }
    };
  }
}
