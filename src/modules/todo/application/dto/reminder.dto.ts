import type { Reminder } from '../../domain/entities/reminder';

export interface ReminderDto {
  readonly id: string;
  readonly todoId: string;
  readonly triggerType: string;
  readonly remindAt: Date | null;
  readonly offsetMinutes: number | null;
  /** Hasil perhitungan dinamis; tidak disimpan sebagai kolom terpisah. */
  readonly effectiveAt: Date | null;
  readonly status: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly cancelledAt: Date | null;
}

export interface ReminderListResponseDto {
  items: ReminderDto[];
  pagination: {
    limit: number;
    hasMore: boolean;
    nextCursor: string | null;
  };
}

export function toReminderDto(reminder: Reminder, dueAt: Date | null): ReminderDto {
  return {
    id: reminder.id,
    todoId: reminder.todoId,
    triggerType: reminder.triggerType,
    remindAt: reminder.remindAt,
    offsetMinutes: reminder.offsetMinutes,
    effectiveAt: reminder.effectiveAt(dueAt),
    status: reminder.status,
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt,
    cancelledAt: reminder.cancelledAt
  };
}
