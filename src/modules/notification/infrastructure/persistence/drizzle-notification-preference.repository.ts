import { eq } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../../shared/infrastructure/database/client';
import type { NotificationPreference } from '../../domain/entities/notification-preference';
import type { NotificationPreferenceRepository } from '../../domain/repositories/notification-preference.repository';
import { notificationPreferences } from './notification-preference.schema';

export class DrizzleNotificationPreferenceRepository implements NotificationPreferenceRepository {
  constructor(private readonly database: DatabaseExecutor) {}

  async findByUserId(userId: string): Promise<NotificationPreference | null> {
    const rows = await this.database
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, userId))
      .limit(1);
    const row = rows[0];

    return row
      ? { userId: row.userId, emailEnabled: row.emailEnabled, updatedAt: row.updatedAt }
      : null;
  }

  async upsert(preference: NotificationPreference): Promise<NotificationPreference> {
    const rows = await this.database
      .insert(notificationPreferences)
      .values({
        userId: preference.userId,
        emailEnabled: preference.emailEnabled,
        updatedAt: preference.updatedAt
      })
      .onConflictDoUpdate({
        target: notificationPreferences.userId,
        set: { emailEnabled: preference.emailEnabled, updatedAt: preference.updatedAt }
      })
      .returning();
    const row = rows[0];

    if (!row) {
      throw new Error('Preferensi notifikasi tidak dapat disimpan.');
    }

    return { userId: row.userId, emailEnabled: row.emailEnabled, updatedAt: row.updatedAt };
  }
}
