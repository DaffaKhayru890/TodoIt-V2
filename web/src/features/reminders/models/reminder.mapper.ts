import { ApiError } from '@/core/errors/api-error';
import type {
  CreateReminderRequestDto,
  ListRemindersResponseDto,
  ReminderDto,
  UpdateReminderRequestDto
} from './reminder.dto';
import {
  isReminderStatus,
  isReminderTriggerType,
  type CreateReminderInput,
  type Reminder,
  type ReminderListResult,
  type UpdateReminderInput
} from './reminder.model';

function parseDate(value: string): Date {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new ApiError('Tanggal reminder dari server tidak valid.', 0, 'INVALID_REMINDER_RESPONSE');
  }

  return date;
}

function parseNullableDate(value: string | null): Date | null {
  return value === null ? null : parseDate(value);
}

export function toReminder(dto: ReminderDto): Reminder {
  if (!isReminderTriggerType(dto.triggerType) || !isReminderStatus(dto.status)) {
    throw new ApiError('Reminder dari server tidak valid.', 0, 'INVALID_REMINDER_RESPONSE');
  }

  return {
    id: dto.id,
    todoId: dto.todoId,
    triggerType: dto.triggerType,
    remindAt: parseNullableDate(dto.remindAt),
    offsetMinutes: dto.offsetMinutes,
    effectiveAt: parseNullableDate(dto.effectiveAt),
    status: dto.status,
    createdAt: parseDate(dto.createdAt),
    updatedAt: parseDate(dto.updatedAt),
    cancelledAt: parseNullableDate(dto.cancelledAt)
  };
}

export function toReminderListResult(dto: ListRemindersResponseDto): ReminderListResult {
  return {
    items: dto.items.map(toReminder),
    pagination: {
      limit: dto.pagination.limit,
      hasMore: dto.pagination.hasMore,
      nextCursor: dto.pagination.nextCursor
    }
  };
}

export function toCreateReminderRequestDto(
  input: CreateReminderInput
): CreateReminderRequestDto {
  return {
    triggerType: input.triggerType,
    ...(input.remindAt !== undefined
      ? { remindAt: input.remindAt === null ? null : input.remindAt.toISOString() }
      : {}),
    ...(input.offsetMinutes !== undefined ? { offsetMinutes: input.offsetMinutes } : {})
  };
}

export function toUpdateReminderRequestDto(
  input: UpdateReminderInput
): UpdateReminderRequestDto {
  return {
    ...(input.remindAt !== undefined ? { remindAt: input.remindAt.toISOString() } : {}),
    ...(input.offsetMinutes !== undefined ? { offsetMinutes: input.offsetMinutes } : {})
  };
}
