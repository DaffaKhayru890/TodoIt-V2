import { boolean, pgTable, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from '../../../auth/infrastructure/persistence/auth.schema';

export const notificationPreferences = pgTable('notification_preferences', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  emailEnabled: boolean('email_enabled').notNull().default(false),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'date' }).notNull()
});
