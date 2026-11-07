import { and, desc, eq, isNull, lt, or, sql } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../../shared/infrastructure/database/client';
import { Notification } from '../../domain/entities/notification';
import type { NotificationData } from '../../domain/entities/notification';
import type { NotificationType } from '../../domain/enums/notification-type';
import type {
  NotificationListQuery,
  NotificationRepository
} from '../../domain/repositories/notification.repository';
import { notifications } from './notification.schema';

function toEntity(row: typeof notifications.$inferSelect): Notification {
  return Notification.restore({
    id: row.id,
    recipientUserId: row.recipientUserId,
    workspaceId: row.workspaceId,
    todoId: row.todoId,
    reminderId: row.reminderId,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    data: (row.data ?? {}) as NotificationData,
    idempotencyKey: row.idempotencyKey,
    readAt: row.readAt,
    createdAt: row.createdAt
  });
}

export class DrizzleNotificationRepository implements NotificationRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async insert(notification: Notification): Promise<Notification> {
    const rows = await this.database
      .insert(notifications)
      .values({
        id: notification.id,
        recipientUserId: notification.recipientUserId,
        workspaceId: notification.workspaceId,
        todoId: notification.todoId,
        reminderId: notification.reminderId,
        type: notification.type,
        title: notification.title,
        body: notification.body,
        data: notification.data,
        idempotencyKey: notification.idempotencyKey,
        readAt: notification.readAt,
        createdAt: notification.createdAt
      })
      .onConflictDoNothing({ target: notifications.idempotencyKey })
      .returning();
    const row = rows[0];

    if (row) {
      return toEntity(row);
    }

    const existing = await this.findByIdempotencyKey(notification.idempotencyKey);

    if (!existing) {
      throw new Error('Notifikasi tidak dapat disimpan.');
    }

    return existing;
  }

  async findById(id: string): Promise<Notification | null> {
    const rows = await this.database.select().from(notifications).where(eq(notifications.id, id)).limit(1);
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async findByIdempotencyKey(key: string): Promise<Notification | null> {
    const rows = await this.database
      .select()
      .from(notifications)
      .where(eq(notifications.idempotencyKey, key))
      .limit(1);
    return rows[0] ? toEntity(rows[0]) : null;
  }

  async list(query: NotificationListQuery): Promise<{ items: readonly Notification[]; hasMore: boolean }> {
    const filters = [eq(notifications.recipientUserId, query.recipientUserId)];

    if (query.readStatus === 'unread') {
      filters.push(isNull(notifications.readAt));
    }

    if (query.readStatus === 'read') {
      filters.push(sql`${notifications.readAt} IS NOT NULL`);
    }

    if (query.type) {
      filters.push(eq(notifications.type, query.type));
    }

    if (query.cursor) {
      const cursor = or(
        lt(notifications.createdAt, query.cursor.createdAt),
        and(eq(notifications.createdAt, query.cursor.createdAt), lt(notifications.id, query.cursor.id))
      );

      if (cursor) {
        filters.push(cursor);
      }
    }

    const rows = await this.database
      .select()
      .from(notifications)
      .where(and(...filters))
      .orderBy(desc(notifications.createdAt), desc(notifications.id))
      .limit(query.limit + 1);

    return {
      items: rows.slice(0, query.limit).map(toEntity),
      hasMore: rows.length > query.limit
    };
  }

  async countUnread(recipientUserId: string): Promise<number> {
    const rows = await this.database
      .select({ total: sql<number>`count(*)::int` })
      .from(notifications)
      .where(and(eq(notifications.recipientUserId, recipientUserId), isNull(notifications.readAt)));
    return Number(rows[0]?.total ?? 0);
  }

  async markRead(id: string, recipientUserId: string, readAt: Date): Promise<Notification | null> {
    const current = await this.findById(id);

    if (!current || current.recipientUserId !== recipientUserId) {
      return null;
    }

    if (current.readAt) {
      return current;
    }

    const rows = await this.database
      .update(notifications)
      .set({ readAt })
      .where(and(eq(notifications.id, id), eq(notifications.recipientUserId, recipientUserId), isNull(notifications.readAt)))
      .returning();

    return rows[0] ? toEntity(rows[0]) : current;
  }

  async markAllRead(recipientUserId: string, readAt: Date): Promise<number> {
    const rows = await this.database
      .update(notifications)
      .set({ readAt })
      .where(and(eq(notifications.recipientUserId, recipientUserId), isNull(notifications.readAt)))
      .returning({ id: notifications.id });

    return rows.length;
  }
}
