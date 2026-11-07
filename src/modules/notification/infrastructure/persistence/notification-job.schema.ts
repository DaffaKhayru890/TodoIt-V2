import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
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
import {
  NOTIFICATION_JOB_STATUSES,
  NOTIFICATION_JOB_TYPES
} from '../../domain/enums/notification-job-status';
import { notifications } from './notification.schema';

const TYPE_SQL = sql.raw(NOTIFICATION_JOB_TYPES.map((type) => `'${type}'`).join(', '));
const STATUS_SQL = sql.raw(NOTIFICATION_JOB_STATUSES.map((status) => `'${status}'`).join(', '));

export const notificationJobs = pgTable(
  'notification_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    type: varchar('type', { length: 50 }).notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    idempotencyKey: text('idempotency_key').notNull(),
    recipientUserId: uuid('recipient_user_id').references(() => users.id, { onDelete: 'set null' }),
    workspaceId: uuid('workspace_id').references(() => workspaces.id, { onDelete: 'set null' }),
    todoId: uuid('todo_id').references(() => todos.id, { onDelete: 'set null' }),
    reminderId: uuid('reminder_id').references(() => reminders.id, { onDelete: 'set null' }),
    notificationId: uuid('notification_id').references(() => notifications.id, { onDelete: 'set null' }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true, mode: 'date' }).notNull(),
    availableAt: timestamp('available_at', { withTimezone: true, mode: 'date' }).notNull(),
    payload: jsonb('payload'),
    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull(),
    lockedBy: varchar('locked_by', { length: 100 }),
    lockedAt: timestamp('locked_at', { withTimezone: true, mode: 'date' }),
    lockExpiresAt: timestamp('lock_expires_at', { withTimezone: true, mode: 'date' }),
    lastErrorCode: varchar('last_error_code', { length: 100 }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' })
  },
  (table) => [
    uniqueIndex('notification_jobs_idempotency_key_uidx').on(table.idempotencyKey),
    index('notification_jobs_claim_idx')
      .on(table.availableAt, table.id)
      .where(sql`${table.status} IN ('pending', 'processing')`),
    index('notification_jobs_lock_expiry_idx')
      .on(table.lockExpiresAt)
      .where(sql`${table.status} = 'processing'`),
    index('notification_jobs_type_status_available_idx').on(table.type, table.status, table.availableAt),
    index('notification_jobs_recipient_idx').on(table.recipientUserId),
    index('notification_jobs_todo_id_idx').on(table.todoId),
    index('notification_jobs_reminder_id_idx').on(table.reminderId),
    index('notification_jobs_notification_id_idx').on(table.notificationId),
    check('notification_jobs_type_check', sql`${table.type} IN (${TYPE_SQL})`),
    check('notification_jobs_status_check', sql`${table.status} IN (${STATUS_SQL})`),
    check('notification_jobs_attempts_check', sql`${table.attempts} >= 0`),
    check('notification_jobs_max_attempts_check', sql`${table.maxAttempts} > 0`),
    check(
      'notification_jobs_lease_check',
      sql`(
        (${table.status} = 'processing' AND ${table.lockedBy} IS NOT NULL AND ${table.lockedAt} IS NOT NULL AND ${table.lockExpiresAt} IS NOT NULL)
        OR (${table.status} <> 'processing' AND ${table.lockedBy} IS NULL AND ${table.lockedAt} IS NULL AND ${table.lockExpiresAt} IS NULL)
      )`
    ),
    check(
      'notification_jobs_completed_at_check',
      sql`(
        (${table.status} = 'completed' AND ${table.completedAt} IS NOT NULL)
        OR (${table.status} <> 'completed' AND ${table.completedAt} IS NULL)
      )`
    )
  ]
);
