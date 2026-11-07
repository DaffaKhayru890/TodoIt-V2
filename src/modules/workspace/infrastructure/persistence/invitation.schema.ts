import { sql } from 'drizzle-orm';
import {
  check,
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar
} from 'drizzle-orm/pg-core';
import { users } from '../../../auth/infrastructure/persistence/auth.schema';
import { EMAIL_DELIVERY_STATUSES } from '../../domain/enums/email-delivery-status';
import { INVITATION_STATUSES } from '../../domain/enums/invitation-status';
import { workspaces } from './workspace.schema';

const STATUS_SQL = sql.raw(INVITATION_STATUSES.map((status) => `'${status}'`).join(', '));
const DELIVERY_SQL = sql.raw(EMAIL_DELIVERY_STATUSES.map((status) => `'${status}'`).join(', '));

/**
 * Undangan workspace. Hanya hash token yang disimpan.
 * Partial unique index mencegah dua pending untuk workspace + email yang sama.
 */
export const workspaceInvitations = pgTable(
  'workspace_invitations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workspaceId: uuid('workspace_id')
      .notNull()
      .references(() => workspaces.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 320 }).notNull(),
    normalizedEmail: varchar('normalized_email', { length: 320 }).notNull(),
    role: varchar('role', { length: 20 }).notNull(),
    tokenHash: text('token_hash').notNull(),
    status: varchar('status', { length: 20 }).notNull(),
    invitedBy: uuid('invited_by')
      .notNull()
      .references(() => users.id),
    acceptedBy: uuid('accepted_by').references(() => users.id),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    acceptedAt: timestamp('accepted_at', { withTimezone: true, mode: 'date' }),
    declinedAt: timestamp('declined_at', { withTimezone: true, mode: 'date' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    deliveryStatus: varchar('delivery_status', { length: 20 }).notNull(),
    emailSentAt: timestamp('email_sent_at', { withTimezone: true, mode: 'date' }),
    emailLastAttemptAt: timestamp('email_last_attempt_at', { withTimezone: true, mode: 'date' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull()
  },
  (table) => [
    uniqueIndex('workspace_invitations_token_hash_uidx').on(table.tokenHash),
    uniqueIndex('workspace_invitations_pending_email_uidx')
      .on(table.workspaceId, table.normalizedEmail)
      .where(sql`${table.status} = 'pending'`),
    index('workspace_invitations_workspace_id_idx').on(table.workspaceId),
    index('workspace_invitations_normalized_email_idx').on(table.normalizedEmail),
    index('workspace_invitations_status_idx').on(table.status),
    index('workspace_invitations_expires_at_idx').on(table.expiresAt),
    index('workspace_invitations_workspace_created_at_id_idx').on(
      table.workspaceId,
      table.createdAt.desc(),
      table.id.desc()
    ),
    check('workspace_invitations_role_check', sql`${table.role} IN ('admin', 'member')`),
    check('workspace_invitations_status_check', sql`${table.status} IN (${STATUS_SQL})`),
    check(
      'workspace_invitations_delivery_status_check',
      sql`${table.deliveryStatus} IN (${DELIVERY_SQL})`
    ),
    check(
      'workspace_invitations_state_check',
      sql`(
        (${table.status} = 'pending' AND ${table.acceptedAt} IS NULL AND ${table.acceptedBy} IS NULL AND ${table.declinedAt} IS NULL AND ${table.revokedAt} IS NULL)
        OR (${table.status} = 'expired' AND ${table.acceptedAt} IS NULL AND ${table.acceptedBy} IS NULL AND ${table.declinedAt} IS NULL AND ${table.revokedAt} IS NULL)
        OR (${table.status} = 'accepted' AND ${table.acceptedAt} IS NOT NULL AND ${table.acceptedBy} IS NOT NULL AND ${table.declinedAt} IS NULL AND ${table.revokedAt} IS NULL)
        OR (${table.status} = 'declined' AND ${table.declinedAt} IS NOT NULL AND ${table.acceptedAt} IS NULL AND ${table.acceptedBy} IS NULL AND ${table.revokedAt} IS NULL)
        OR (${table.status} = 'revoked' AND ${table.revokedAt} IS NOT NULL AND ${table.acceptedAt} IS NULL AND ${table.acceptedBy} IS NULL AND ${table.declinedAt} IS NULL)
      )`
    )
  ]
);
