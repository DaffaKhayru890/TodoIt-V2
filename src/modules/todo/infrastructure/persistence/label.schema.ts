import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { users } from '../../../auth/infrastructure/persistence/auth.schema';
import { workspaces } from '../../../workspace/infrastructure/persistence/workspace.schema';

/**
 * Label dimiliki satu Workspace dan unik berdasarkan normalized_name.
 * Warna disimpan dalam bentuk kanonik #RRGGBB uppercase.
 */
export const labels = pgTable(
  'labels',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(),
    normalizedName: varchar('normalized_name', { length: 50 }).notNull(),
    color: varchar('color', { length: 7 }).notNull(),
    description: varchar('description', { length: 300 }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  (table) => [
    uniqueIndex('labels_workspace_id_normalized_name_uidx').on(
      table.workspaceId,
      table.normalizedName
    ),
    index('labels_workspace_id_idx').on(table.workspaceId),
    check(
      'labels_name_length_check',
      sql`char_length(btrim(${table.name})) BETWEEN 1 AND 50`
    ),
    check(
      'labels_normalized_name_length_check',
      sql`char_length(${table.normalizedName}) BETWEEN 1 AND 50`
    ),
    check('labels_color_check', sql`${table.color} ~ '^#[0-9A-F]{6}$'`),
    check(
      'labels_description_length_check',
      sql`${table.description} IS NULL OR char_length(${table.description}) <= 300`
    ),
    check(
      'labels_timestamp_order_check',
      sql`${table.updatedAt} >= ${table.createdAt}`
    )
  ]
);
