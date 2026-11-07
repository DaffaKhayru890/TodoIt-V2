import { TodoError } from '../../../domain/errors/todo-error';
import {
  ReminderStatus,
  isReminderStatus
} from '../../../domain/enums/reminder-status';
import type { ReminderRepository } from '../../../domain/repositories/reminder.repository';
import type { TodoRepository } from '../../../domain/repositories/todo.repository';
import { toReminderDto, type ReminderListResponseDto } from '../../dto/reminder.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { ReminderCursorCodec } from '../../ports/reminder-cursor-codec';
import { normalizeMetadataLimit } from '../../services/metadata-pagination';
import type { TodoAccessService } from '../../services/todo-access.service';

export const DEFAULT_REMINDER_LIST_LIMIT = 20;
export const MAX_REMINDER_LIST_LIMIT = 100;

export type ReminderStatusFilter = ReminderStatus | 'all';

export interface ListTodoRemindersInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
  readonly status?: string | undefined;
  readonly limit?: number | undefined;
  readonly cursor?: string | null | undefined;
}

function resolveStatusFilter(status: string | undefined): ReminderStatusFilter {
  if (status === undefined || status === 'scheduled') {
    return ReminderStatus.SCHEDULED;
  }

  if (status === 'all') {
    return 'all';
  }

  if (isReminderStatus(status)) {
    return status;
  }

  throw TodoError.validationError('status harus bernilai scheduled, cancelled, atau all.');
}

export class ListTodoReminders {
  constructor(
    private readonly todos: TodoRepository,
    private readonly reminders: ReminderRepository,
    private readonly access: TodoAccessService,
    private readonly cursorCodec: ReminderCursorCodec
  ) {}

  async execute(input: ListTodoRemindersInput): Promise<ReminderListResponseDto> {
    const limit = normalizeMetadataLimit(input.limit);
    const status = resolveStatusFilter(input.status);

    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.VIEW);

    const todo = await this.todos.findActiveById(input.workspaceId, input.todoId);

    if (!todo) {
      throw TodoError.notFound();
    }

    const fingerprint = this.cursorCodec.fingerprint({
      kind: 'reminders',
      todoId: input.todoId,
      status
    });
    const cursor =
      input.cursor === undefined || input.cursor === null
        ? null
        : this.cursorCodec.decode(input.cursor, {
            todoId: input.todoId,
            fingerprint
          });

    const statuses =
      status === 'all' ? undefined : [status];

    const result = await this.reminders.list({
      todoId: input.todoId,
      ...(statuses !== undefined ? { statuses } : {}),
      dueAt: todo.dueAt,
      cursor,
      limit
    });

    const lastItem = result.items[result.items.length - 1];
    const hasMore = result.hasMore && lastItem !== undefined;
    const nextCursor =
      hasMore && lastItem
        ? this.cursorCodec.encode({
            todoId: input.todoId,
            effectiveAt: lastItem.effectiveAt(todo.dueAt),
            id: lastItem.id,
            fingerprint
          })
        : null;

    return {
      items: result.items.map((reminder) => toReminderDto(reminder, todo.dueAt)),
      pagination: { limit, hasMore, nextCursor }
    };
  }
}
