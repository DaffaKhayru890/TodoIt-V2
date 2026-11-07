export interface NotificationPreference {
  readonly userId: string;
  readonly emailEnabled: boolean;
  readonly updatedAt: Date;
}

export function defaultNotificationPreference(userId: string, now: Date): NotificationPreference {
  return { userId, emailEnabled: false, updatedAt: now };
}
