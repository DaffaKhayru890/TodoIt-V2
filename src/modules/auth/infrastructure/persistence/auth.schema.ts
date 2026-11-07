import { index, pgTable, text, timestamp, uniqueIndex, uuid, varchar } from 'drizzle-orm/pg-core';
import type { AnyPgColumn } from 'drizzle-orm/pg-core';

/**
 * Tabel milik Authentication Module. Email disimpan sudah dinormalisasi (trim +
 * lowercase) sehingga uniqueness berlaku pada bentuk canonical, bukan pada
 * variasi penulisan klien.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 320 }).notNull().unique(),
  displayName: varchar('display_name', { length: 80 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
});

/**
 * Satu session = satu perangkat/browser. Session di-revoke saat logout atau saat
 * token reuse terdeteksi; akses token ditolak bila session-nya tidak aktif lagi.
 */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true, mode: 'date' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    /** Hanya string UA; IP address sengaja tidak disimpan pada fase ini. */
    userAgent: text('user_agent')
  },
  (table) => [
    index('auth_sessions_user_id_idx').on(table.userId),
    index('auth_sessions_expires_at_idx').on(table.expiresAt)
  ]
);

/**
 * Refresh token disimpan sebagai hash SHA-256 (hex) atas token opaque. Kolom
 * consumed_at menandai token yang sudah dirotasi dan menjadi dasar reuse
 * detection; replaced_by_token_id membentuk rantai rotasi.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    sessionId: uuid('session_id')
      .notNull()
      .references(() => authSessions.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true, mode: 'date' }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true, mode: 'date' }),
    revokedAt: timestamp('revoked_at', { withTimezone: true, mode: 'date' }),
    /**
     * Self-reference memerlukan callback tertunda; tanpa anotasi tipe eksplisit
     * TypeScript menolak menyimpulkan tipe tabel ini (siklus inferensi).
     */
    replacedByTokenId: uuid('replaced_by_token_id').references(
      (): AnyPgColumn => refreshTokens.id,
      { onDelete: 'set null' }
    ),
    createdAt: timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow()
  },
  (table) => [
    uniqueIndex('refresh_tokens_token_hash_uidx').on(table.tokenHash),
    index('refresh_tokens_session_id_idx').on(table.sessionId),
    index('refresh_tokens_expires_at_idx').on(table.expiresAt)
  ]
);
