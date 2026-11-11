import { paths } from '@/app/router/route-paths';
import type { AppNotification } from '../models/notification.model';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(value: string | undefined): value is string {
  return value !== undefined && UUID_PATTERN.test(value);
}

/**
 * Notifikasi backend hanya menyediakan relasi todo/workspace pada payload
 * `data`. Tidak ada route invitation/activity yang tersedia, sehingga target
 * di luar todo sengaja tidak ditebak.
 */
export function getNotificationTarget(notification: AppNotification): string | null {
  const { workspaceId, todoId } = notification.data;

  if (!isUuid(workspaceId) || !isUuid(todoId)) {
    return null;
  }

  return paths.todo(workspaceId, todoId);
}

export function getNotificationTargetLabel(notification: AppNotification): string {
  return getNotificationTarget(notification)
    ? 'Buka tugas terkait'
    : 'Tugas terkait tidak tersedia';
}
