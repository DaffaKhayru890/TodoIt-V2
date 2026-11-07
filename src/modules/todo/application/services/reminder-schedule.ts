import { TodoError } from '../../domain/errors/todo-error';
import {
  ReminderTriggerType,
  isReminderTriggerType
} from '../../domain/enums/reminder-trigger-type';
import { assertReminderOffset } from '../../domain/entities/reminder';

export interface ReminderScheduleInput {
  readonly triggerType: string;
  readonly remindAt?: Date | null | undefined;
  readonly offsetMinutes?: number | null | undefined;
}

export interface ResolvedReminderSchedule {
  readonly triggerType: ReminderTriggerType;
  readonly remindAt: Date | null;
  readonly offsetMinutes: number | null;
}

function assertFuture(value: Date, now: Date): void {
  if (value.getTime() <= now.getTime()) {
    throw TodoError.reminderTimeInPast();
  }
}

/**
 * Validasi bentuk jadwal reminder pada saat create.
 *
 * absolute: remindAt wajib, offsetMinutes harus null, dan remindAt future.
 * before_due: offsetMinutes wajib, remindAt harus null. Pemeriksaan effective
 * time dilakukan use case karena membutuhkan dueAt Todo.
 */
export function resolveReminderSchedule(
  input: ReminderScheduleInput,
  now: Date
): ResolvedReminderSchedule {
  if (!isReminderTriggerType(input.triggerType)) {
    throw TodoError.reminderTriggerTypeInvalid();
  }

  if (input.triggerType === ReminderTriggerType.ABSOLUTE) {
    if (input.remindAt === undefined || input.remindAt === null) {
      throw TodoError.reminderTimeInvalid('remindAt wajib diberikan untuk reminder absolute.');
    }

    if (input.offsetMinutes !== undefined && input.offsetMinutes !== null) {
      throw TodoError.reminderTimeInvalid(
        'offsetMinutes tidak boleh diberikan untuk reminder absolute.'
      );
    }

    if (!(input.remindAt instanceof Date) || Number.isNaN(input.remindAt.getTime())) {
      throw TodoError.reminderTimeInvalid('remindAt harus berupa tanggal yang valid.');
    }

    assertFuture(input.remindAt, now);

    return {
      triggerType: input.triggerType,
      remindAt: new Date(input.remindAt.getTime()),
      offsetMinutes: null
    };
  }

  if (input.remindAt !== undefined && input.remindAt !== null) {
    throw TodoError.reminderTimeInvalid(
      'remindAt tidak boleh diberikan untuk reminder before_due.'
    );
  }

  if (input.offsetMinutes === undefined || input.offsetMinutes === null) {
    throw TodoError.reminderTimeInvalid(
      'offsetMinutes wajib diberikan untuk reminder before_due.'
    );
  }

  return {
    triggerType: input.triggerType,
    remindAt: null,
    offsetMinutes: assertReminderOffset(input.offsetMinutes)
  };
}
