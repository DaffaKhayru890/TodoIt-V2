import type { Clock } from '../../../../../shared/domain/clock';
import { Reminder } from '../../../domain/entities/reminder';
import { ReminderTriggerType } from '../../../domain/enums/reminder-trigger-type';
import { TodoStatus } from '../../../domain/enums/todo-status';
import { TodoError } from '../../../domain/errors/todo-error';
import { toReminderDto, type ReminderDto } from '../../dto/reminder.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoUnitOfWork } from '../../ports/todo-unit-of-work';
import { resolveReminderSchedule } from '../../services/reminder-schedule';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface CreateReminderInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
  readonly triggerType: string;
  readonly remindAt?: Date | null | undefined;
  readonly offsetMinutes?: number | null | undefined;
}

export class CreateReminder {
  constructor(
    private readonly access: TodoAccessService,
    private readonly uow: TodoUnitOfWork,
    private readonly clock: Clock
  ) {}

  async execute(input: CreateReminderInput): Promise<ReminderDto> {
    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.UPDATE);

    const result = await this.uow.run(async (tx) => {
      // Lock baris Todo: dueAt yang dipakai untuk effectiveAt tidak dapat
      // berubah bersamaan dengan pembuatan reminder.
      const todo = await tx.lockActiveTodo(input.workspaceId, input.todoId);

      if (!todo) {
        throw TodoError.notFound();
      }

      if (todo.status === TodoStatus.COMPLETED || todo.status === TodoStatus.CANCELLED) {
        throw TodoError.reminderTodoIneligible();
      }

      const now = this.clock.now();
      const schedule = resolveReminderSchedule(
        {
          triggerType: input.triggerType,
          remindAt: input.remindAt,
          offsetMinutes: input.offsetMinutes
        },
        now
      );

      if (schedule.triggerType === ReminderTriggerType.BEFORE_DUE) {
        if (todo.dueAt === null) {
          throw TodoError.reminderDueDateRequired();
        }

        const offsetMinutes = schedule.offsetMinutes;

        if (offsetMinutes === null) {
          throw TodoError.reminderOffsetInvalid();
        }

        const effectiveAt = new Date(
          todo.dueAt.getTime() - offsetMinutes * 60_000
        );

        if (effectiveAt.getTime() <= now.getTime()) {
          throw TodoError.reminderTimeInPast();
        }
      }

      const reminder = Reminder.create({
        id: crypto.randomUUID(),
        todoId: input.todoId,
        createdBy: input.userId,
        triggerType: schedule.triggerType,
        remindAt: schedule.remindAt,
        offsetMinutes: schedule.offsetMinutes,
        now
      });

      const created = await tx.reminders.create(reminder);

      return { reminder: created, dueAt: todo.dueAt };
    });

    return toReminderDto(result.reminder, result.dueAt);
  }
}
