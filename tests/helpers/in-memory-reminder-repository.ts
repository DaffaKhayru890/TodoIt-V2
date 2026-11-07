import type { Reminder } from '../../src/modules/todo/domain/entities/reminder';
import { ReminderStatus } from '../../src/modules/todo/domain/enums/reminder-status';
import { ReminderTriggerType } from '../../src/modules/todo/domain/enums/reminder-trigger-type';
import { TodoError } from '../../src/modules/todo/domain/errors/todo-error';
import type {
  CancelReminderOutcome,
  ReminderListQuery,
  ReminderListResult,
  ReminderRepository
} from '../../src/modules/todo/domain/repositories/reminder.repository';

function isSameScheduledSchedule(left: Reminder, right: Reminder): boolean {
  if (
    left.status !== ReminderStatus.SCHEDULED ||
    right.status !== ReminderStatus.SCHEDULED
  ) {
    return false;
  }

  if (left.triggerType !== right.triggerType) {
    return false;
  }

  if (left.triggerType === ReminderTriggerType.ABSOLUTE) {
    return left.remindAt?.getTime() === right.remindAt?.getTime();
  }

  return left.offsetMinutes === right.offsetMinutes;
}

/**
 * In-memory Reminder repository dengan ordering effectiveAt ASC, NULLS LAST dan
 * id ASC, sesuai query SQL. effectiveAt dihitung dari dueAt pada setiap list.
 */
export class InMemoryReminderRepository implements ReminderRepository {
  readonly reminders: Reminder[] = [];

  async create(reminder: Reminder): Promise<Reminder> {
    const duplicate = this.reminders.some(
      (candidate) =>
        candidate.todoId === reminder.todoId &&
        isSameScheduledSchedule(candidate, reminder)
    );

    if (duplicate) {
      throw TodoError.reminderDuplicate();
    }

    this.reminders.push(reminder);
    return reminder;
  }

  async findById(todoId: string, reminderId: string): Promise<Reminder | null> {
    return (
      this.reminders.find(
        (reminder) => reminder.todoId === todoId && reminder.id === reminderId
      ) ?? null
    );
  }

  async update(reminder: Reminder): Promise<Reminder | null> {
    const index = this.reminders.findIndex(
      (candidate) =>
        candidate.todoId === reminder.todoId && candidate.id === reminder.id
    );

    const existing = index >= 0 ? this.reminders[index] : undefined;

    if (!existing || existing.isCancelled) {
      return null;
    }

    const duplicate = this.reminders.some(
      (candidate) =>
        candidate.todoId === reminder.todoId &&
        candidate.id !== reminder.id &&
        isSameScheduledSchedule(candidate, reminder)
    );

    if (duplicate) {
      throw TodoError.reminderDuplicate();
    }

    this.reminders[index] = reminder;
    return reminder;
  }

  async list(query: ReminderListQuery): Promise<ReminderListResult> {
    const statuses = query.statuses ? new Set(query.statuses) : null;

    const withinCursor = (reminder: Reminder): boolean => {
      if (query.cursor === null) {
        return true;
      }

      const effectiveAt = reminder.effectiveAt(query.dueAt);
      const cursorEffectiveAt = query.cursor.effectiveAt;

      if (cursorEffectiveAt === null) {
        return effectiveAt === null && reminder.id > query.cursor.id;
      }

      if (effectiveAt === null) {
        return true;
      }

      const difference = effectiveAt.getTime() - cursorEffectiveAt.getTime();

      if (difference > 0) {
        return true;
      }

      if (difference === 0) {
        return reminder.id > query.cursor.id;
      }

      return false;
    };

    const filtered = this.reminders.filter((reminder) => {
      if (reminder.todoId !== query.todoId) {
        return false;
      }

      if (statuses !== null && !statuses.has(reminder.status)) {
        return false;
      }

      return withinCursor(reminder);
    });

    filtered.sort((left, right) => {
      const leftEffective = left.effectiveAt(query.dueAt);
      const rightEffective = right.effectiveAt(query.dueAt);

      if (leftEffective === null && rightEffective === null) {
        return left.id.localeCompare(right.id);
      }

      if (leftEffective === null) {
        return 1;
      }

      if (rightEffective === null) {
        return -1;
      }

      const difference = leftEffective.getTime() - rightEffective.getTime();

      if (difference !== 0) {
        return difference;
      }

      return left.id.localeCompare(right.id);
    });

    const hasMore = filtered.length > query.limit;
    const items = hasMore ? filtered.slice(0, query.limit) : filtered;

    return { items, hasMore };
  }

  async cancel(
    todoId: string,
    reminderId: string,
    now: Date
  ): Promise<CancelReminderOutcome> {
    const index = this.reminders.findIndex(
      (reminder) => reminder.todoId === todoId && reminder.id === reminderId
    );

    const existing = index >= 0 ? this.reminders[index] : undefined;

    if (!existing) {
      return 'not_found';
    }

    if (existing.isCancelled) {
      return 'already_cancelled';
    }

    this.reminders[index] = existing.cancel(now);
    return 'cancelled';
  }

  async findScheduledByTodoId(todoId: string): Promise<readonly Reminder[]> {
    return this.reminders
      .filter(
        (reminder) =>
          reminder.todoId === todoId &&
          reminder.status === ReminderStatus.SCHEDULED
      )
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  async cancelScheduledByTodoId(todoId: string, now: Date): Promise<number> {
    let cancelled = 0;

    for (let index = 0; index < this.reminders.length; index += 1) {
      const reminder = this.reminders[index];

      if (
        !reminder ||
        reminder.todoId !== todoId ||
        reminder.status !== ReminderStatus.SCHEDULED
      ) {
        continue;
      }

      this.reminders[index] = reminder.cancel(now);
      cancelled += 1;
    }

    return cancelled;
  }
}
