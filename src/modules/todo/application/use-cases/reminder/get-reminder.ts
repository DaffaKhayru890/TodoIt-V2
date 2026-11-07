import { TodoError } from '../../../domain/errors/todo-error';
import type { ReminderRepository } from '../../../domain/repositories/reminder.repository';
import type { TodoRepository } from '../../../domain/repositories/todo.repository';
import { toReminderDto, type ReminderDto } from '../../dto/reminder.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface GetReminderInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
  readonly reminderId: string;
}

export class GetReminder {
  constructor(
    private readonly todos: TodoRepository,
    private readonly reminders: ReminderRepository,
    private readonly access: TodoAccessService
  ) {}

  async execute(input: GetReminderInput): Promise<ReminderDto> {
    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.VIEW);

    const todo = await this.todos.findActiveById(input.workspaceId, input.todoId);

    if (!todo) {
      throw TodoError.notFound();
    }

    const reminder = await this.reminders.findById(input.todoId, input.reminderId);

    if (!reminder) {
      throw TodoError.reminderNotFound();
    }

    return toReminderDto(reminder, todo.dueAt);
  }
}
