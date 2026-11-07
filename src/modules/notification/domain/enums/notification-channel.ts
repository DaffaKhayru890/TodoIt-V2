export const NotificationChannel = {
  IN_APP: 'in_app',
  EMAIL: 'email'
} as const;

export type NotificationChannel = (typeof NotificationChannel)[keyof typeof NotificationChannel];
