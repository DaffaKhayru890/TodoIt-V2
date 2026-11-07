import type { CreateReminder } from '../../application/use-cases/reminder/create-reminder';
import type { ListTodoReminders } from '../../application/use-cases/reminder/list-todo-reminders';
import type { GetReminder } from '../../application/use-cases/reminder/get-reminder';
import type { UpdateReminder } from '../../application/use-cases/reminder/update-reminder';
import type { CancelReminder } from '../../application/use-cases/reminder/cancel-reminder';
import type {
  ReminderDto,
  ReminderListResponseDto
} from '../../application/dto/reminder.dto';
import { parseExplicitInstant } from '../../application/services/instant-parser';

export interface CreateReminderBody {
  readonly triggerType: string;
  readonly remindAt?: string | null | undefined;
  readonly offsetMinutes?: number | null | undefined;
}

export interface UpdateReminderBody {
  readonly remindAt?: string | undefined;
  readonly offsetMinutes?: number | undefined;
}

/**
 * remindAt null/undefined pada create berarti tidak diberikan; string valid
 * di-parse dengan pola instant eksplisit yang sama seperti dueAt.
 */
function parseOptionalReminderInstant(
  value: string | null | undefined
): Date | null {
  if (value === undefined || value === null) {
    return null;
  }

  return parseExplicitInstant(value, 'REMINDER_TIME_INVALID');
}

export interface ListRemindersQuery {
  readonly status?: string | undefined;
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
}

export interface ReminderHandlers {
  create(
    userId: string,
    workspaceId: string,
    todoId: string,
    body: CreateReminderBody
  ): Promise<{ reminder: ReminderDto }>;
  list(
    userId: string,
    workspaceId: string,
    todoId: string,
    query: ListRemindersQuery
  ): Promise<ReminderListResponseDto>;
  get(
    userId: string,
    workspaceId: string,
    todoId: string,
    reminderId: string
  ): Promise<{ reminder: ReminderDto }>;
  update(
    userId: string,
    workspaceId: string,
    todoId: string,
    reminderId: string,
    body: UpdateReminderBody
  ): Promise<{ reminder: ReminderDto }>;
  cancel(
    userId: string,
    workspaceId: string,
    todoId: string,
    reminderId: string
  ): Promise<void>;
}

export function createReminderHandlers(deps: {
  readonly createReminder: CreateReminder;
  readonly listTodoReminders: ListTodoReminders;
  readonly getReminder: GetReminder;
  readonly updateReminder: UpdateReminder;
  readonly cancelReminder: CancelReminder;
}): ReminderHandlers {
  return {
    async create(userId, workspaceId, todoId, body) {
      const reminder = await deps.createReminder.execute({
        workspaceId,
        userId,
        todoId,
        triggerType: body.triggerType,
        remindAt: parseOptionalReminderInstant(body.remindAt),
        offsetMinutes: body.offsetMinutes
      });

      return { reminder };
    },

    async list(userId, workspaceId, todoId, query) {
      return await deps.listTodoReminders.execute({
        workspaceId,
        userId,
        todoId,
        status: query.status,
        limit: query.limit,
        cursor: query.cursor
      });
    },

    async get(userId, workspaceId, todoId, reminderId) {
      const reminder = await deps.getReminder.execute({
        workspaceId,
        userId,
        todoId,
        reminderId
      });

      return { reminder };
    },

    async update(userId, workspaceId, todoId, reminderId, body) {
      const reminder = await deps.updateReminder.execute({
        workspaceId,
        userId,
        todoId,
        reminderId,
        remindAt:
          body.remindAt !== undefined
            ? parseExplicitInstant(body.remindAt, 'REMINDER_TIME_INVALID')
            : undefined,
        offsetMinutes: body.offsetMinutes
      });

      return { reminder };
    },

    async cancel(userId, workspaceId, todoId, reminderId) {
      await deps.cancelReminder.execute({
        workspaceId,
        userId,
        todoId,
        reminderId
      });
    }
  };
}
