import { noopAuditRecorder, safeRecord, type AuditRecorder } from '../../../../shared/application/audit-recorder';
import type { Clock } from '../../../../shared/domain/clock';
import { NotificationError } from '../../domain/errors/notification-error';
import type { NotificationPreference } from '../../domain/entities/notification-preference';
import { defaultNotificationPreference } from '../../domain/entities/notification-preference';
import type { NotificationPreferenceRepository } from '../../domain/repositories/notification-preference.repository';
import type { NotificationRepository } from '../../domain/repositories/notification.repository';

export class GetUnreadCount {
  constructor(private readonly notifications: NotificationRepository) {}

  async execute(userId: string): Promise<{ unreadCount: number }> {
    return { unreadCount: await this.notifications.countUnread(userId) };
  }
}

export class MarkNotificationRead {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly clock: Clock
  ) {}

  async execute(input: { userId: string; notificationId: string }) {
    const updated = await this.notifications.markRead(input.notificationId, input.userId, this.clock.now());

    if (!updated) {
      throw NotificationError.notFound();
    }

    return {
      notification: {
        id: updated.id,
        type: updated.type,
        title: updated.title,
        body: updated.body,
        data: updated.data,
        readAt: updated.readAt,
        createdAt: updated.createdAt
      }
    };
  }
}

export class MarkAllNotificationsRead {
  constructor(
    private readonly notifications: NotificationRepository,
    private readonly clock: Clock
  ) {}

  async execute(userId: string): Promise<{ updated: number }> {
    return { updated: await this.notifications.markAllRead(userId, this.clock.now()) };
  }
}

export class GetNotificationPreferences {
  constructor(
    private readonly preferences: NotificationPreferenceRepository,
    private readonly clock: Clock
  ) {}

  async execute(userId: string): Promise<{ preferences: { inAppEnabled: true; emailEnabled: boolean } }> {
    const stored = await this.preferences.findByUserId(userId);
    const preference = stored ?? defaultNotificationPreference(userId, this.clock.now());

    return { preferences: { inAppEnabled: true, emailEnabled: preference.emailEnabled } };
  }
}

export class UpdateNotificationPreferences {
  constructor(
    private readonly preferences: NotificationPreferenceRepository,
    private readonly clock: Clock,
    private readonly audit: AuditRecorder = noopAuditRecorder
  ) {}

  async execute(input: { userId: string; emailEnabled: boolean }): Promise<{
    preferences: { inAppEnabled: true; emailEnabled: boolean };
  }> {
    const now = this.clock.now();
    const saved: NotificationPreference = await this.preferences.upsert({
      userId: input.userId,
      emailEnabled: input.emailEnabled,
      updatedAt: now
    });

    await safeRecord(this.audit, {
      actorUserId: input.userId,
      action: 'notification.preferences_updated',
      resourceType: 'notification_preference',
      resourceId: null,
      workspaceId: null,
      requestId: null,
      outcome: 'success',
      metadata: { emailEnabled: saved.emailEnabled },
      occurredAt: now
    });

    return { preferences: { inAppEnabled: true, emailEnabled: saved.emailEnabled } };
  }
}
