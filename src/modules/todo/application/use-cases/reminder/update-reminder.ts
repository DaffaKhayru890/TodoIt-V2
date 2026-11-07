import type { Clock } from '../../../../../shared/domain/clock';
import { ReminderTriggerType } from '../../../domain/enums/reminder-trigger-type';
import { TodoError } from '../../../domain/errors/todo-error';
import { toReminderDto, type ReminderDto } from '../../dto/reminder.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoUnitOfWork } from '../../ports/todo-unit-of-work';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface UpdateReminderInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
  readonly reminderId: string;
  readonly remindAt?: Date | undefined;
  readonly offsetMinutes?: number | undefined;
}

export class UpdateReminder {
  constructor(
    private readonly access: TodoAccessService,
    private readonly uow: TodoUnitOfWork,
    private readonly clock: Clock
  ) {}

  async execute(input: UpdateReminderInput): Promise<ReminderDto> {
    if (input.remindAt === undefined && input.offsetMinutes === undefined) {
      throw TodoError.validationError('Minimal satu field jadwal harus diubah.');
    }

    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.UPDATE);

    const result = await this.uow.run(async (tx) => {
      const todo = await tx.lockActiveTodo(input.workspaceId, input.todoId);

      if (!todo) {
        throw TodoError.notFound();
      }

      const existing = await tx.reminders.findById(input.todoId, input.reminderId);

      if (!existing) {
        throw TodoError.reminderNotFound();
      }

      const now = this.clock.now();
      const updated = existing.updateSchedule(
        {
          ...(input.remindAt !== undefined ? { remindAt: input.remindAt } : {}),
          ...(input.offsetMinutes !== undefined
            ? { offsetMinutes: input.offsetMinutes }
            : {})
        },
        now
      );

      // Validasi future dilakukan setelah entity memastikan bentuk jadwal.
      if (updated.triggerType === ReminderTriggerType.ABSOLUTE) {
        const remindAt = updated.remindAt;

        if (remindAt === null || remindAt.getTime() <= now.getTime()) {
          throw TodoError.reminderTimeInPast();
        }
      } else {
        if (todo.dueAt === null) {
          throw TodoError.reminderDueDateRequired();
        }

        const effectiveAt = updated.effectiveAt(todo.dueAt);

        if (effectiveAt === null || effectiveAt.getTime() <= now.getTime()) {
          throw TodoError.reminderTimeInPast();
        }
      }

      const persisted = await tx.reminders.update(updated);

      if (!persisted) {
        // Bisa terjadi bila reminder dibatalkan bersamaan; bedakan agar pesan
        // tetap akurat dan tidak menyesatkan menjadi 404.
        const current = await tx.reminders.findById(input.todoId, input.reminderId);

        if (current?.isCancelled) {
          throw TodoError.reminderAlreadyCancelled();
        }

        throw TodoError.reminderNotFound();
      }

      return { reminder: persisted, dueAt: todo.dueAt };
    });

    return toReminderDto(result.reminder, result.dueAt);
  }
}
