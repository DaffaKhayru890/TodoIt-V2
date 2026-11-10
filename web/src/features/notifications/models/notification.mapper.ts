import type { NotificationDto, NotificationListResponseDto } from './notification.dto';
import type { AppNotification, NotificationListResult } from './notification.model';
import { isNotificationType } from './notification.model';
import { toNotificationData } from './notification.guard';

export function toAppNotification(dto: NotificationDto): AppNotification {
  if (!isNotificationType(dto.type)) {
    throw new Error('Jenis notifikasi tidak dikenal.');
  }

  return {
    id: dto.id,
    type: dto.type,
    title: dto.title,
    body: dto.body,
    data: toNotificationData(dto.data),
    readAt: dto.readAt ? new Date(dto.readAt) : null,
    createdAt: new Date(dto.createdAt)
  };
}

export function toNotificationListResult(
  dto: NotificationListResponseDto
): NotificationListResult {
  return {
    items: dto.items.map(toAppNotification),
    pagination: {
      limit: dto.pagination.limit,
      hasMore: dto.pagination.hasMore,
      nextCursor: dto.pagination.nextCursor
    }
  };
}
