import type { CreateTodo } from '../../application/use-cases/create-todo';
import type { ListTodos } from '../../application/use-cases/list-todos';
import type { GetTodo } from '../../application/use-cases/get-todo';
import type { UpdateTodo } from '../../application/use-cases/update-todo';
import type { DeleteTodo } from '../../application/use-cases/delete-todo';
import type { CompleteTodo } from '../../application/use-cases/complete-todo';
import type { ListTodayTodos } from '../../application/use-cases/list-today-todos';
import type { ListUpcomingTodos } from '../../application/use-cases/list-upcoming-todos';
import type { ListOverdueTodos } from '../../application/use-cases/list-overdue-todos';
import { parseExplicitInstant } from '../../application/services/instant-parser';
import type { TodoDto, TodoListResponseDto } from '../../application/dto/todo.dto';

export interface CreateTodoBody {
  readonly title: string;
  readonly description?: string | null | undefined;
  readonly priority?: string | undefined;
  readonly dueAt?: string | null | undefined;
}

export interface UpdateTodoBody {
  readonly title?: string | undefined;
  readonly description?: string | null | undefined;
  readonly status?: string | undefined;
  readonly priority?: string | undefined;
  readonly dueAt?: string | null | undefined;
  readonly labelId?: string | null | undefined;
}

export interface ListTodosQuery {
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly status?: string | undefined;
  readonly priority?: string | undefined;
  readonly dueFrom?: string | undefined;
  readonly dueTo?: string | undefined;
  readonly createdFrom?: string | undefined;
  readonly createdTo?: string | undefined;
  readonly q?: string | undefined;
  readonly tagIds?: readonly string[] | undefined;
  readonly labelId?: string | undefined;
}

export interface TodayTodosQuery {
  readonly timezone?: string | undefined;
  readonly includeCompleted?: boolean | undefined;
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly tagIds?: readonly string[] | undefined;
  readonly labelId?: string | undefined;
}

export interface UpcomingTodosQuery {
  readonly timezone?: string | undefined;
  readonly days?: number | undefined;
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly tagIds?: readonly string[] | undefined;
  readonly labelId?: string | undefined;
}

export interface OverdueTodosQuery {
  readonly timezone?: string | undefined;
  readonly limit?: number | undefined;
  readonly cursor?: string | undefined;
  readonly tagIds?: readonly string[] | undefined;
  readonly labelId?: string | undefined;
}

export interface TodoHandlers {
  create(userId: string, workspaceId: string, body: CreateTodoBody): Promise<{ todo: TodoDto }>;
  list(userId: string, workspaceId: string, query: ListTodosQuery): Promise<TodoListResponseDto>;
  get(userId: string, workspaceId: string, todoId: string): Promise<{ todo: TodoDto }>;
  update(userId: string, workspaceId: string, todoId: string, body: UpdateTodoBody): Promise<{ todo: TodoDto }>;
  complete(userId: string, workspaceId: string, todoId: string): Promise<{ todo: TodoDto }>;
  remove(userId: string, workspaceId: string, todoId: string): Promise<void>;
  today(userId: string, workspaceId: string, query: TodayTodosQuery): Promise<TodoListResponseDto>;
  upcoming(userId: string, workspaceId: string, query: UpcomingTodosQuery): Promise<TodoListResponseDto>;
  overdue(userId: string, workspaceId: string, query: OverdueTodosQuery): Promise<TodoListResponseDto>;
}

function parseOptionalInstant(
  value: string | null | undefined,
  errorCode: 'TODO_DUE_DATE_INVALID' | 'INVALID_DATE_RANGE'
): Date | null | undefined {
  if (value === undefined || value === null) {
    return value;
  }

  return parseExplicitInstant(value, errorCode);
}

/**
 * Presentation handlers memetakan request tervalidasi ke use case. Tidak ada
 * business rule di sini: seluruh keputusan tetap berada pada application layer.
 */
export function createTodoHandlers(deps: {
  readonly createTodo: CreateTodo;
  readonly listTodos: ListTodos;
  readonly getTodo: GetTodo;
  readonly updateTodo: UpdateTodo;
  readonly deleteTodo: DeleteTodo;
  readonly completeTodo: CompleteTodo;
  readonly listTodayTodos: ListTodayTodos;
  readonly listUpcomingTodos: ListUpcomingTodos;
  readonly listOverdueTodos: ListOverdueTodos;
}): TodoHandlers {
  return {
    async create(userId, workspaceId, body) {
      const todo = await deps.createTodo.execute({
        workspaceId,
        userId,
        title: body.title,
        description: body.description,
        priority: body.priority,
        dueAt: parseOptionalInstant(body.dueAt, 'TODO_DUE_DATE_INVALID')
      });

      return { todo };
    },

    async list(userId, workspaceId, query) {
      return await deps.listTodos.execute({
        workspaceId,
        userId,
        limit: query.limit,
        cursor: query.cursor,
        status: query.status,
        priority: query.priority,
        dueFrom: parseOptionalInstant(query.dueFrom, 'INVALID_DATE_RANGE') ?? undefined,
        dueTo: parseOptionalInstant(query.dueTo, 'INVALID_DATE_RANGE') ?? undefined,
        createdFrom: parseOptionalInstant(query.createdFrom, 'INVALID_DATE_RANGE') ?? undefined,
        createdTo: parseOptionalInstant(query.createdTo, 'INVALID_DATE_RANGE') ?? undefined,
        q: query.q,
        tagIds: query.tagIds,
        labelId: query.labelId
      });
    },

    async get(userId, workspaceId, todoId) {
      const todo = await deps.getTodo.execute({ workspaceId, userId, todoId });

      return { todo };
    },

    async update(userId, workspaceId, todoId, body) {
      const todo = await deps.updateTodo.execute({
        workspaceId,
        userId,
        todoId,
        title: body.title,
        description: body.description,
        status: body.status,
        priority: body.priority,
        dueAt: parseOptionalInstant(body.dueAt, 'TODO_DUE_DATE_INVALID'),
        labelId: body.labelId
      });

      return { todo };
    },

    async complete(userId, workspaceId, todoId) {
      const todo = await deps.completeTodo.execute({ workspaceId, userId, todoId });

      return { todo };
    },

    async remove(userId, workspaceId, todoId) {
      await deps.deleteTodo.execute({ workspaceId, userId, todoId });
    },

    async today(userId, workspaceId, query) {
      return await deps.listTodayTodos.execute({
        workspaceId,
        userId,
        timezone: query.timezone,
        includeCompleted: query.includeCompleted,
        limit: query.limit,
        cursor: query.cursor,
        tagIds: query.tagIds,
        labelId: query.labelId
      });
    },

    async upcoming(userId, workspaceId, query) {
      return await deps.listUpcomingTodos.execute({
        workspaceId,
        userId,
        timezone: query.timezone,
        days: query.days,
        limit: query.limit,
        cursor: query.cursor,
        tagIds: query.tagIds,
        labelId: query.labelId
      });
    },

    async overdue(userId, workspaceId, query) {
      return await deps.listOverdueTodos.execute({
        workspaceId,
        userId,
        timezone: query.timezone,
        limit: query.limit,
        cursor: query.cursor,
        tagIds: query.tagIds,
        labelId: query.labelId
      });
    }
  };
}
