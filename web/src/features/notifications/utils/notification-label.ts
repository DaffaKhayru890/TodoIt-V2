import type { NotificationType } from '../models/notification.model';

export interface NotificationTypeConfig {
  readonly label: string;
  readonly tone: 'warning' | 'danger';
}

const TYPE_CONFIG: Record<NotificationType, NotificationTypeConfig> = {
  reminder_due: { label: 'Pengingat', tone: 'danger' },
  todo_due_soon: { label: 'Tenggat mendekat', tone: 'warning' }
};

export function getNotificationTypeConfig(type: NotificationType): NotificationTypeConfig {
  return TYPE_CONFIG[type];
}

export function getNotificationTypeLabel(type: NotificationType): string {
  return getNotificationTypeConfig(type).label;
}
