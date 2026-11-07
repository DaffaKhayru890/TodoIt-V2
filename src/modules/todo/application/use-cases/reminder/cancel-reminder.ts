import type { Clock } from '../../../../../shared/domain/clock';
import { TodoError } from '../../../domain/errors/todo-error';
import type { ReminderRepository } from '../../../domain/repositories/reminder.repository';
import type { TodoRepository } from '../../../domain/repositories/todo.repository';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface CancelReminderInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
  readonly reminderId: string;
}

export class CancelReminder {
  constructor(
    private readonly todos: TodoRepository,
    private readonly reminders: ReminderRepository,
    private readonly access: TodoAccessService,
    private readonly clock: Clock
  ) {}

  /**
   * Cancel bersifat idempoten: memanggil dua kali tetap sukses dan tidak
   * menggeser cancelledAt. Reminder tidak pernah dihapus permanen pada fase ini
   * agar history tetap dapat ditampilkan.
   */
  async execute(input: CancelReminderInput): Promise<void> {
    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.UPDATE);

    const todo = await this.todos.findActiveById(input.workspaceId, input.todoId);

    if (!todo) {
      throw TodoError.notFound();
    }

    const outcome = await this.reminders.cancel(
      input.todoId,
      input.reminderId,
      this.clock.now()
    );

    if (outcome === 'not_found') {
      throw TodoError.reminderNotFound();
    }
  }
}
