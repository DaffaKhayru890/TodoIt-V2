import { sql } from 'drizzle-orm';
import { check, index, pgTable, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import { WORKSPACE_ROLES } from '../../domain/enums/workspace-role';
import { users } from '../../../auth/infrastructure/persistence/auth.schema';

/**
 * Tabel milik Workspace Module.
 *
 * Import `users` di bawah adalah dependensi infrastructure-to-infrastructure yang
 * sengaja dan satu-satunya: PostgreSQL memerlukan referensi tabel induk untuk
 * foreign key. Domain dan Application workspace tetap tidak mengenal modul auth;
 * yang lewat ke lapisan dalam hanyalah user id bertipe string.
 */
export const workspaces = pgTable(
  'workspaces',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 100 }).notNull(),
    description: varchar('description', { length: 500 }),
    createdBy: uuid('created_by')
      .notNull()
      .references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    /** Soft archive: workspace tidak pernah dihapus permanen pada fase ini. */
    archivedAt: timestamp('archived_at', { withTimezone: true, mode: 'date' })
  },
  (table) => [index('workspaces_created_by_idx').on(table.createdBy), index('workspaces_archived_at_idx').on(table.archivedAt)]
);

export const workspaceMembers = pgTable(
  'workspace_members',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull(),
    joinedAt: timestamp('joined_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('workspace_members_workspace_id_user_id_uidx').on(table.workspaceId, table.userId),
    index('workspace_members_user_id_idx').on(table.userId),
    index('workspace_members_workspace_id_idx').on(table.workspaceId),
    // Check constraint (bukan database enum) supaya evolusi role tidak butuh ALTER TYPE.
    // sql.raw dipakai karena DDL tidak bisa memakai parameter placeholder; daftarnya
    // berasal dari konstanta kompilasi WORKSPACE_ROLES, bukan input pengguna.
    check(
      'workspace_members_role_check',
      sql`${table.role} IN (${sql.raw(WORKSPACE_ROLES.map((role) => `'${role}'`).join(', '))})`
    )
  ]
);
