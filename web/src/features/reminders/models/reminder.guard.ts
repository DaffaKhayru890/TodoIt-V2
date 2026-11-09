import { ApiError } from '@/core/errors/api-error';
import type {
  ListRemindersResponseDto,
  ReminderDto,
  ReminderResponseDto
} from './reminder.dto';

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isIsoDate(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function isNullableIsoDate(value: unknown): value is string | null {
  return value === null || isIsoDate(value);
}

function isReminderDto(value: unknown): value is ReminderDto {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.todoId === 'string' &&
    typeof value.triggerType === 'string' &&
    isNullableIsoDate(value.remindAt) &&
    (value.offsetMinutes === null ||
      (typeof value.offsetMinutes === 'number' && Number.isInteger(value.offsetMinutes))) &&
    isNullableIsoDate(value.effectiveAt) &&
    typeof value.status === 'string' &&
    isIsoDate(value.createdAt) &&
    isIsoDate(value.updatedAt) &&
    isNullableIsoDate(value.cancelledAt)
  );
}

function invalidResponse(): never {
  throw new ApiError('Respons reminder dari server tidak valid.', 0, 'INVALID_REMINDER_RESPONSE');
}

export function assertReminderResponseDto(value: unknown): asserts value is ReminderResponseDto {
  if (!isObject(value) || !isReminderDto(value.reminder)) {
    invalidResponse();
  }
}

export function assertReminderListResponseDto(
  value: unknown
): asserts value is ListRemindersResponseDto {
  if (!isObject(value) || !Array.isArray(value.items) || !value.items.every(isReminderDto)) {
    invalidResponse();
  }

  const pagination = value.pagination;

  if (
    !isObject(pagination) ||
    typeof pagination.limit !== 'number' ||
    typeof pagination.hasMore !== 'boolean' ||
    !isNullableString(pagination.nextCursor)
  ) {
    invalidResponse();
  }
}
