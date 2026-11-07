import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { TODO_PRIORITIES } from '../../domain/enums/todo-priority';
import { TODO_STATUSES } from '../../domain/enums/todo-status';
import { users } from '../../../auth/infrastructure/persistence/auth.schema';
import { workspaces } from '../../../workspace/infrastructure/persistence/workspace.schema';
import { labels } from './label.schema';

const STATUS_SQL_LIST = sql.raw(TODO_STATUSES.map((status) => `'${status}'`).join(', '));
const PRIORITY_SQL_LIST = sql.raw(TODO_PRIORITIES.map((priority) => `'${priority}'`).join(', '));

/**
 * Tabel Todo milik Todo Module.
 *
 * Import `users` dan `workspaces` sengaja hanya ada di infrastructure karena
 * PostgreSQL membutuhkan tabel induk untuk foreign key. Domain/Application Todo
 * hanya mengenal string id dan tidak pernah mengimpor schema ini.
 *
 * Index listing memakai partial index `deleted_at IS NULL` karena seluruh query
 * bisnis hanya membaca data aktif; soft-deleted row tetap tersimpan untuk audit.
 */
export const todos = pgTable(
  'todos',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    title: varchar('title', { length: 200 }).notNull(),
    description: text('description'),
    status: varchar('status', { length: 20 }).notNull(),
    priority: varchar('priority', { length: 20 }).notNull(),
    dueAt: timestamp('due_at', { withTimezone: true, mode: 'date' }),
    completedAt: timestamp('completed_at', { withTimezone: true, mode: 'date' }),
    /** Label utama; ON DELETE SET NULL menjaga Todo tetap ada saat Label dihapus. */
    labelId: uuid('label_id').references(() => labels.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true, mode: 'date' })
  },
  (table) => [
    // Default listing: workspace + created_at DESC + id DESC (tie-breaker).
    index('todos_workspace_created_at_id_idx')
      .on(table.workspaceId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} IS NULL`),
    // Filter status + keyset ordering.
    index('todos_workspace_status_created_at_id_idx')
      .on(table.workspaceId, table.status, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} IS NULL`),
    // Filter priority + keyset ordering.
    index('todos_workspace_priority_created_at_id_idx')
      .on(table.workspaceId, table.priority, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} IS NULL`),
    // Today/Upcoming/Overdue dan filter dueFrom/dueTo.
    index('todos_workspace_due_at_idx')
      .on(table.workspaceId, table.dueAt)
      .where(sql`${table.deletedAt} IS NULL`),
    // Filter labelId pada listing dan Today/Upcoming/Overdue.
    index('todos_workspace_label_id_created_at_id_idx')
      .on(table.workspaceId, table.labelId, table.createdAt.desc(), table.id.desc())
      .where(sql`${table.deletedAt} IS NULL`),
    // Dukungan audit/query data terhapus per workspace.
    index('todos_workspace_deleted_at_idx').on(table.workspaceId, table.deletedAt),
    check(
      'todos_status_check',
      sql`${table.status} IN (${STATUS_SQL_LIST})`
    ),
    check(
      'todos_priority_check',
      sql`${table.priority} IN (${PRIORITY_SQL_LIST})`
    ),
    check(
      'todos_title_length_check',
      sql`char_length(btrim(${table.title})) BETWEEN 1 AND 200`
    ),
    check(
      'todos_description_length_check',
      sql`${table.description} IS NULL OR char_length(${table.description}) <= 5000`
    ),
    check(
      'todos_completed_at_check',
      sql`(${table.status} = 'completed' AND ${table.completedAt} IS NOT NULL) OR (${table.status} <> 'completed' AND ${table.completedAt} IS NULL)`
    ),
    check(
      'todos_timestamp_order_check',
      sql`${table.updatedAt} >= ${table.createdAt} AND (${table.deletedAt} IS NULL OR ${table.deletedAt} >= ${table.createdAt})`
    )
  ]
);
