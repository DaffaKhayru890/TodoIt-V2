import { Reminder } from '../../domain/entities/reminder';
import type { ReminderStatus } from '../../domain/enums/reminder-status';
import type { ReminderTriggerType } from '../../domain/enums/reminder-trigger-type';
import type { reminders } from '../persistence/reminder.schema';

export type ReminderRow = typeof reminders.$inferSelect;

export function toReminderEntity(row: ReminderRow): Reminder {
  return Reminder.restore({
    id: row.id,
    todoId: row.todoId,
    createdBy: row.createdBy,
    triggerType: row.triggerType as ReminderTriggerType,
    remindAt: row.remindAt,
    offsetMinutes: row.offsetMinutes,
    status: row.status as ReminderStatus,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    cancelledAt: row.cancelledAt
  });
}
