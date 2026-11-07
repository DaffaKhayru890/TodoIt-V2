import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { users } from '../../../auth/infrastructure/persistence/auth.schema';
import { reminders } from '../../../todo/infrastructure/persistence/reminder.schema';
import { todos } from '../../../todo/infrastructure/persistence/todo.schema';
import { workspaces } from '../../../workspace/infrastructure/persistence/workspace.schema';
import { NOTIFICATION_TYPES } from '../../domain/enums/notification-type';

const TYPE_SQL = sql.raw(NOTIFICATION_TYPES.map((type) => `'${type}'`).join(', '));

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    recipientUserId: uuid('recipient_user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    todoId: uuid('todo_id').references(() => todos.id, { onDelete: 'set null' }),
    reminderId: uuid('reminder_id').references(() => reminders.id, { onDelete: 'set null' }),
    type: varchar('type', { length: 40 }).notNull(),
    title: varchar('title', { length: 200 }).notNull(),
    body: text('body').notNull(),
    data: jsonb('data'),
    idempotencyKey: text('idempotency_key').notNull(),
    readAt: timestamp('read_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  (table) => [
    uniqueIndex('notifications_idempotency_key_uidx').on(table.idempotencyKey),
    index('notifications_recipient_created_id_idx').on(
      table.recipientUserId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    index('notifications_recipient_read_at_idx').on(table.recipientUserId, table.readAt),
    index('notifications_recipient_type_created_idx').on(
      table.recipientUserId,
      table.type,
      table.createdAt.desc()
    ),
    index('notifications_unread_idx')
      .on(table.recipientUserId)
      .where(sql`${table.readAt} IS NULL`),
    index('notifications_workspace_id_idx').on(table.workspaceId),
    index('notifications_todo_id_idx').on(table.todoId),
    check('notifications_type_check', sql`${table.type} IN (${TYPE_SQL})`)
  ]
);
