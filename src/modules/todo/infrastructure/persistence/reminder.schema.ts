import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { REMINDER_STATUSES } from '../../domain/enums/reminder-status';
import { REMINDER_TRIGGER_TYPES } from '../../domain/enums/reminder-trigger-type';
import { users } from '../../../auth/infrastructure/persistence/auth.schema';
import { todos } from './todo.schema';

const TRIGGER_SQL_LIST = sql.raw(
  REMINDER_TRIGGER_TYPES.map((trigger) => `'${trigger}'`).join(', ')
);
const STATUS_SQL_LIST = sql.raw(
  REMINDER_STATUSES.map((status) => `'${status}'`).join(', ')
);

/**
 * Reminder milik satu Todo.
 *
 * effectiveAt TIDAK disimpan; nilainya selalu dihitung dari remind_at
 * (absolute) atau due_at - offset_minutes (before_due). Partial unique index
 * mencegah jadwal scheduled yang duplikat meskipun ada request konkuren.
 */
export const reminders = pgTable(
  'reminders',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    todoId: uuid('todo_id')
      .notNull()
      .references(() => todos.id, { onDelete: 'cascade' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    triggerType: varchar('trigger_type', { length: 20 }).notNull(),
    remindAt: timestamp('remind_at', { withTimezone: true, mode: 'date' }),
    offsetMinutes: integer('offset_minutes'),
    status: varchar('status', { length: 20 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true, mode: 'date' })
  },
  (table) => [
    index('reminders_todo_id_idx').on(table.todoId),
    index('reminders_todo_id_status_idx').on(table.todoId, table.status),
    index('reminders_trigger_type_idx').on(table.triggerType),
    index('reminders_scheduled_absolute_remind_at_idx')
      .on(table.remindAt)
      .where(sql`${table.status} = 'scheduled' AND ${table.triggerType} = 'absolute'`),
    // Dua reminder scheduled absolute tidak boleh memiliki remindAt yang sama.
    uniqueIndex('reminders_absolute_schedule_uidx')
      .on(table.todoId, table.remindAt)
      .where(sql`${table.triggerType} = 'absolute' AND ${table.status} = 'scheduled'`),
    // Dua reminder scheduled before_due tidak boleh memiliki offset yang sama.
    uniqueIndex('reminders_before_due_schedule_uidx')
      .on(table.todoId, table.offsetMinutes)
      .where(sql`${table.triggerType} = 'before_due' AND ${table.status} = 'scheduled'`),
    check(
      'reminders_trigger_type_check',
      sql`${table.triggerType} IN (${TRIGGER_SQL_LIST})`
    ),
    check(
      'reminders_status_check',
      sql`${table.status} IN (${STATUS_SQL_LIST})`
    ),
    check(
      'reminders_absolute_shape_check',
      sql`(${table.triggerType} <> 'absolute') OR (${table.remindAt} IS NOT NULL AND ${table.offsetMinutes} IS NULL)`
    ),
    check(
      'reminders_before_due_shape_check',
      sql`(${table.triggerType} <> 'before_due') OR (${table.remindAt} IS NULL AND ${table.offsetMinutes} BETWEEN 1 AND 43200)`
    ),
    check(
      'reminders_cancelled_at_check',
      sql`(${table.status} = 'cancelled' AND ${table.cancelledAt} IS NOT NULL) OR (${table.status} = 'scheduled' AND ${table.cancelledAt} IS NULL)`
    ),
    check(
      'reminders_timestamp_order_check',
      sql`${table.updatedAt} >= ${table.createdAt} AND (${table.cancelledAt} IS NULL OR ${table.cancelledAt} >= ${table.createdAt})`
    )
  ]
);
