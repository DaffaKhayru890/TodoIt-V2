export const NotificationJobType = {
  DISPATCH_REMINDER: 'dispatch_reminder',
  DISPATCH_TODO_DUE_SOON: 'dispatch_todo_due_soon',
  SEND_EMAIL: 'send_email'
} as const;

export type NotificationJobType = (typeof NotificationJobType)[keyof typeof NotificationJobType];

export const NOTIFICATION_JOB_TYPES: readonly NotificationJobType[] = [
  NotificationJobType.DISPATCH_REMINDER,
  NotificationJobType.DISPATCH_TODO_DUE_SOON,
  NotificationJobType.SEND_EMAIL
];

export const NotificationJobStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  COMPLETED: 'completed',
  FAILED: 'failed',
  CANCELLED: 'cancelled'
} as const;

export type NotificationJobStatus = (typeof NotificationJobStatus)[keyof typeof NotificationJobStatus];

export const NOTIFICATION_JOB_STATUSES: readonly NotificationJobStatus[] = [
  NotificationJobStatus.PENDING,
  NotificationJobStatus.PROCESSING,
  NotificationJobStatus.COMPLETED,
  NotificationJobStatus.FAILED,
  NotificationJobStatus.CANCELLED
];
