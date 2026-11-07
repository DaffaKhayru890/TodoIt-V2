import type { NotificationPreference } from '../entities/notification-preference';

export interface NotificationPreferenceRepository {
  findByUserId(userId: string): Promise<NotificationPreference | null>;
  upsert(preference: NotificationPreference): Promise<NotificationPreference>;
}
