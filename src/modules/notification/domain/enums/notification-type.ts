export const NotificationType = {
  REMINDER_DUE: 'reminder_due',
  TODO_DUE_SOON: 'todo_due_soon'
} as const;

export type NotificationType = (typeof NotificationType)[keyof typeof NotificationType];

export const NOTIFICATION_TYPES: readonly NotificationType[] = [
  NotificationType.REMINDER_DUE,
  NotificationType.TODO_DUE_SOON
];

export function isNotificationType(value: string): value is NotificationType {
  return (NOTIFICATION_TYPES as readonly string[]).includes(value);
}
