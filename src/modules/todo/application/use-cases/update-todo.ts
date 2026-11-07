import type { Clock } from '../../../../shared/domain/clock';
import { isTodoPriority, type TodoPriority } from '../../domain/enums/todo-priority';
import { isTodoStatus, TodoStatus, type TodoStatus as TodoStatusType } from '../../domain/enums/todo-status';
import { ReminderTriggerType } from '../../domain/enums/reminder-trigger-type';
import { TodoError } from '../../domain/errors/todo-error';
import type { ReminderRepository } from '../../domain/repositories/reminder.repository';
import { toTodoDto, type TodoDto } from '../dto/todo.dto';
import { TodoAction } from '../policies/todo-access.policy';
import type { TodoMetadataService } from '../services/todo-metadata.service';
import type { TodoAccessService } from '../services/todo-access.service';
import type { TodoUnitOfWork } from '../ports/todo-unit-of-work';

export interface UpdateTodoInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
  readonly title?: string | undefined;
  readonly description?: string | null | undefined;
  readonly status?: string | undefined;
  readonly priority?: string | undefined;
  readonly dueAt?: Date | null | undefined;
  readonly labelId?: string | null | undefined;
}

function isTerminalStatus(status: TodoStatusType): boolean {
  return status === TodoStatus.COMPLETED || status === TodoStatus.CANCELLED;
}

/**
 * Memastikan perubahan dueAt tidak membuat reminder before_due yang masih
 * scheduled menjadi tidak valid. Dipanggil di dalam transaksi dengan baris Todo
 * sudah terkunci, sehingga dueAt tidak dapat berubah bersamaan.
 */
async function assertDueDateCompatibleWithReminders(
  reminders: ReminderRepository,
  todoId: string,
  nextDueAt: Date | null,
  now: Date
): Promise<void> {
  const scheduled = await reminders.findScheduledByTodoId(todoId);
  const relative = scheduled.filter(
    (reminder) => reminder.triggerType === ReminderTriggerType.BEFORE_DUE
  );

  if (relative.length === 0) {
    return;
  }

  if (nextDueAt === null) {
    throw TodoError.todoHasRelativeReminders();
  }

  for (const reminder of relative) {
    const effectiveAt = reminder.effectiveAt(nextDueAt);

    if (effectiveAt !== null && effectiveAt.getTime() <= now.getTime()) {
      throw TodoError.todoDueDateConflictsWithReminders();
    }
  }
}

export class UpdateTodo {
  constructor(
    private readonly access: TodoAccessService,
    private readonly uow: TodoUnitOfWork,
    private readonly metadata: TodoMetadataService,
    private readonly clock: Clock
  ) {}

  async execute(input: UpdateTodoInput): Promise<TodoDto> {
    const hasUpdatableField =
      input.title !== undefined ||
      input.description !== undefined ||
      input.status !== undefined ||
      input.priority !== undefined ||
      input.dueAt !== undefined ||
      input.labelId !== undefined;

    if (!hasUpdatableField) {
      throw TodoError.validationError('Minimal satu field harus diubah.');
    }

    let status: TodoStatusType | undefined;

    if (input.status !== undefined) {
      if (!isTodoStatus(input.status)) {
        throw TodoError.invalidStatus();
      }

      status = input.status;
    }

    let priority: TodoPriority | undefined;

    if (input.priority !== undefined) {
      if (!isTodoPriority(input.priority)) {
        throw TodoError.invalidPriority();
      }

      priority = input.priority;
    }

    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.UPDATE);

    const persisted = await this.uow.run(async (tx) => {
      const existing = await tx.lockActiveTodo(input.workspaceId, input.todoId);

      if (!existing) {
        throw TodoError.notFound();
      }

      if (input.labelId !== undefined && input.labelId !== null) {
        const label = await tx.labels.findById(input.workspaceId, input.labelId);

        if (!label) {
          throw TodoError.todoLabelAssignmentInvalid(
            'Label tidak ditemukan pada workspace ini.'
          );
        }
      }

      const now = this.clock.now();
      const nextStatus = status ?? existing.status;

      if (input.dueAt !== undefined && !isTerminalStatus(nextStatus)) {
        const currentDueAt = existing.dueAt;
        const nextDueAt = input.dueAt;
        const changed =
          (currentDueAt === null) !== (nextDueAt === null) ||
          (currentDueAt !== null &&
            nextDueAt !== null &&
            currentDueAt.getTime() !== nextDueAt.getTime());

        if (changed) {
          await assertDueDateCompatibleWithReminders(
            tx.reminders,
            input.todoId,
            nextDueAt,
            now
          );
        }
      }

      const updated = existing.update(
        {
          ...(input.title !== undefined ? { title: input.title } : {}),
          ...(input.description !== undefined ? { description: input.description } : {}),
          ...(status !== undefined ? { status } : {}),
          ...(priority !== undefined ? { priority } : {}),
          ...(input.dueAt !== undefined ? { dueAt: input.dueAt } : {}),
          ...(input.labelId !== undefined ? { labelId: input.labelId } : {})
        },
        now
      );

      const result = await tx.todos.update(updated);

      if (!result) {
        throw TodoError.notFound();
      }

      // Lifecycle terminal membatalkan reminder scheduled secara atomik dalam
      // transaksi yang sama. Reopen tidak pernah mengaktifkan reminder lama.
      if (isTerminalStatus(result.status)) {
        await tx.reminders.cancelScheduledByTodoId(input.todoId, now);
      }

      return result;
    });

    const relations = await this.metadata.loadOne(input.workspaceId, persisted);

    return toTodoDto(persisted, relations);
  }
}
