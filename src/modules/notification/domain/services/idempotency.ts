export function reminderJobKey(reminderId: string, effectiveAt: Date): string {
  return `reminder:${reminderId}:${effectiveAt.toISOString()}`;
}

export function dueSoonJobKey(todoId: string, dueAt: Date, offsetMinutes: number): string {
  return `todo-due-soon:${todoId}:${dueAt.toISOString()}:${offsetMinutes}`;
}

export function emailJobKey(notificationId: string): string {
  return `notification-email:${notificationId}`;
}

export function reminderNotificationKey(reminderId: string, effectiveAt: Date): string {
  return `notification:${reminderJobKey(reminderId, effectiveAt)}`;
}

export function dueSoonNotificationKey(todoId: string, dueAt: Date, offsetMinutes: number): string {
  return `notification:${dueSoonJobKey(todoId, dueAt, offsetMinutes)}`;
}

export function notificationMessageId(notificationId: string): string {
  return `<notification.${notificationId}@todo-backend>`;
}

export function dueSoonPhrase(offsetMinutes: number): string {
  if (offsetMinutes === 60) {
    return '1 hour';
  }

  if (offsetMinutes % 60 === 0) {
    const hours = offsetMinutes / 60;
    return hours === 1 ? '1 hour' : `${hours} hours`;
  }

  return offsetMinutes === 1 ? '1 minute' : `${offsetMinutes} minutes`;
}
