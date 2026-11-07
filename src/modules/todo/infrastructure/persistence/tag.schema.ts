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
 * Tag dimiliki satu Workspace dan unik berdasarkan normalized_name.
 *
 * `users` dan `workspaces` hanya diimpor untuk kebutuhan foreign key di
 * infrastructure; Domain/Application tidak pernah melihat schema ini.
 */
export const tags = pgTable(
  'tags',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 50 }).notNull(),
    normalizedName: varchar('normalized_name', { length: 50 }).notNull(),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  (table) => [
    uniqueIndex('tags_workspace_id_normalized_name_uidx').on(
      table.workspaceId,
      table.normalizedName
    ),
    index('tags_workspace_id_idx').on(table.workspaceId),
    check(
      'tags_name_length_check',
      sql`char_length(btrim(${table.name})) BETWEEN 1 AND 50`
    ),
    check(
      'tags_normalized_name_length_check',
      sql`char_length(${table.normalizedName}) BETWEEN 1 AND 50`
    ),
    check(
      'tags_timestamp_order_check',
      sql`${table.updatedAt} >= ${table.createdAt}`
    )
  ]
);
