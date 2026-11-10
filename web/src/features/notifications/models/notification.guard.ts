import { ApiError } from '@/core/errors/api-error';
import type {
  MarkAllReadResponseDto,
  NotificationDto,
  NotificationListResponseDto,
  NotificationPaginationDto,
  NotificationPreferencesResponseDto,
  NotificationResponseDto,
  UnreadCountResponseDto
} from './notification.dto';
import type { NotificationData, NotificationPreferences } from './notification.model';
import { isNotificationType } from './notification.model';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value);
}

function isNotificationDto(value: unknown): value is NotificationDto {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.type === 'string' &&
    isNotificationType(value.type) &&
    typeof value.title === 'string' &&
    typeof value.body === 'string' &&
    isObject(value.data) &&
    isNullableIsoDate(value.readAt) &&
    isIsoDate(value.createdAt)
  );
}

function isPagination(value: unknown): value is NotificationPaginationDto {
  return (
    isObject(value) &&
    typeof value.limit === 'number' &&
    typeof value.hasMore === 'boolean' &&
    (value.nextCursor === null || typeof value.nextCursor === 'string')
  );
}

function invalidResponse(): never {
  throw new ApiError('Respons notifikasi dari server tidak valid.', 0, 'INVALID_NOTIFICATION_RESPONSE');
}

export function assertNotificationListResponseDto(
  value: unknown
): asserts value is NotificationListResponseDto {
  if (
    !isObject(value) ||
    !Array.isArray(value.items) ||
    !value.items.every(isNotificationDto) ||
    !isPagination(value.pagination)
  ) {
    invalidResponse();
  }
}

export function assertNotificationResponseDto(
  value: unknown
): asserts value is NotificationResponseDto {
  if (!isObject(value) || !isNotificationDto(value.notification)) {
    invalidResponse();
  }
}

export function assertUnreadCountResponseDto(
  value: unknown
): asserts value is UnreadCountResponseDto {
  if (
    !isObject(value) ||
    typeof value.unreadCount !== 'number' ||
    !Number.isFinite(value.unreadCount) ||
    value.unreadCount < 0
  ) {
    invalidResponse();
  }
}

export function assertMarkAllReadResponseDto(
  value: unknown
): asserts value is MarkAllReadResponseDto {
  if (!isObject(value) || typeof value.updated !== 'number' || value.updated < 0) {
    invalidResponse();
  }
}

export function assertNotificationPreferencesResponseDto(
  value: unknown
): asserts value is NotificationPreferencesResponseDto {
  if (
    !isObject(value) ||
    !isObject(value.preferences) ||
    value.preferences.inAppEnabled !== true ||
    typeof value.preferences.emailEnabled !== 'boolean'
  ) {
    invalidResponse();
  }
}

export function toNotificationData(data: Record<string, unknown>): NotificationData {
  return {
    ...(typeof data.todoId === 'string' ? { todoId: data.todoId } : {}),
    ...(typeof data.workspaceId === 'string' ? { workspaceId: data.workspaceId } : {}),
    ...(typeof data.reminderId === 'string' ? { reminderId: data.reminderId } : {}),
    ...(typeof data.dueAt === 'string' ? { dueAt: data.dueAt } : {}),
    ...(typeof data.offsetMinutes === 'number' ? { offsetMinutes: data.offsetMinutes } : {}),
    ...(typeof data.effectiveAt === 'string' ? { effectiveAt: data.effectiveAt } : {})
  };
}

export function toNotificationPreferences(
  dto: NotificationPreferencesResponseDto
): NotificationPreferences {
  return {
    inAppEnabled: true,
    emailEnabled: dto.preferences.emailEnabled
  };
}
