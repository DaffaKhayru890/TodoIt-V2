import { Elysia, t } from 'elysia';
import type { GetCurrentUser } from '../../../auth/application/use-cases/get-current-user';
import { createAuthGuard } from '../../../auth/presentation/http/auth.middleware';
import type { CreateTodo } from '../../application/use-cases/create-todo';
import type { ListTodos } from '../../application/use-cases/list-todos';
import type { GetTodo } from '../../application/use-cases/get-todo';
import type { UpdateTodo } from '../../application/use-cases/update-todo';
import type { DeleteTodo } from '../../application/use-cases/delete-todo';
import type { CompleteTodo } from '../../application/use-cases/complete-todo';
import type { ListTodayTodos } from '../../application/use-cases/list-today-todos';
import type { ListUpcomingTodos } from '../../application/use-cases/list-upcoming-todos';
import type { ListOverdueTodos } from '../../application/use-cases/list-overdue-todos';
import { createTodoHandlers } from './todo.handlers';
import { createTagRoutes, type TagRoutesDependencies } from './tag.routes';
import { createLabelRoutes, type LabelRoutesDependencies } from './label.routes';
import {
  createReminderRoutes,
  type ReminderRoutesDependencies
} from './reminder.routes';
import {
  createTodoBodySchema,
  createTodoResponseSchema,
  errorResponseSchema,
  listTodosQuerySchema,
  listTodosResponseSchema,
  overdueQuerySchema,
  todoIdParamsSchema,
  todoResponseSchema,
  todayQuerySchema,
  upcomingQuerySchema,
  updateTodoBodySchema,
  workspaceIdParamsSchema
} from './todo.schemas';

export interface TodoRoutesDependencies
  extends TagRoutesDependencies,
    LabelRoutesDependencies,
    ReminderRoutesDependencies {
  readonly getCurrentUser: GetCurrentUser;
  readonly createTodo: CreateTodo;
  readonly listTodos: ListTodos;
  readonly getTodo: GetTodo;
  readonly updateTodo: UpdateTodo;
  readonly deleteTodo: DeleteTodo;
  readonly completeTodo: CompleteTodo;
  readonly listTodayTodos: ListTodayTodos;
  readonly listUpcomingTodos: ListUpcomingTodos;
  readonly listOverdueTodos: ListOverdueTodos;
}

const SECURITY = [{ bearerAuth: [] }];

export function createTodoRoutes(deps: TodoRoutesDependencies) {
  const handlers = createTodoHandlers(deps);

  return new Elysia({ prefix: '/api/v1/workspaces', normalize: false })
    .use(createAuthGuard(deps.getCurrentUser))
    .use(createTagRoutes(deps))
    .use(createLabelRoutes(deps))
    .use(createReminderRoutes(deps))
    .post(
      '/:workspaceId/todos',
      async ({ params, body, user, set }) => {
        const result = await handlers.create(user.id, params.workspaceId, body);

        set.status = 201;
        return result;
      },
      {
        params: workspaceIdParamsSchema,
        body: createTodoBodySchema,
        response: {
          201: createTodoResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Todo'],
          summary: 'Buat Todo',
          description:
            'Membuat todo di workspace. Status selalu diawali `todo`, priority default `low`, dan metadata internal (id, workspaceId, createdBy, createdAt, updatedAt, deletedAt) berasal dari server. User harus member workspace.',
          security: SECURITY
        }
      }
    )
    .get(
      '/:workspaceId/todos',
      async ({ params, query, user }) => {
        return await handlers.list(user.id, params.workspaceId, query);
      },
      {
        params: workspaceIdParamsSchema,
        query: listTodosQuerySchema,
        response: {
          200: listTodosResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Todo'],
          summary: 'Daftar Todo (Cursor Pagination)',
          description:
            'Mengambil todo aktif dalam workspace dengan keyset pagination `ORDER BY created_at DESC, id DESC`. ' +
            'Gunakan `pagination.nextCursor` sebagai query `cursor` pada request berikutnya; cursor bersifat opaque dan terikat pada workspace serta filter. ' +
            'Filter yang didukung: status, priority, dueFrom, dueTo, createdFrom, createdTo, q (pencarian title/description), tagIds (ANY semantics, boleh diulang), dan labelId. ' +
            'Setiap item menyertakan `label` (object/null) dan `tags` (array).',
          security: SECURITY
        }
      }
    )
    .get(
      '/:workspaceId/todos/today',
      async ({ params, query, user }) => {
        return await handlers.today(user.id, params.workspaceId, query);
      },
      {
        params: workspaceIdParamsSchema,
        query: todayQuerySchema,
        response: {
          200: listTodosResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Todo'],
          summary: 'Todo Hari Ini (Today View)',
          description:
            'Todo dengan dueAt pada hari ini menurut IANA timezone. Interval [awal hari, awal hari berikutnya). ' +
            'Default timezone UTC dan includeCompleted=false. Todo cancelled selalu dikecualikan; todo completed hanya muncul bila includeCompleted=true. ' +
            'Today berdasarkan dueAt, bukan createdAt. Mendukung filter tagIds (ANY) dan labelId.',
          security: SECURITY
        }
      }
    )
    .get(
      '/:workspaceId/todos/upcoming',
      async ({ params, query, user }) => {
        return await handlers.upcoming(user.id, params.workspaceId, query);
      },
      {
        params: workspaceIdParamsSchema,
        query: upcomingQuerySchema,
        response: {
          200: listTodosResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Todo'],
          summary: 'Todo Akan Datang (Upcoming View)',
          description:
            'Todo dengan dueAt pada rentang [awal hari besok, awal hari (hari ini + days + 1)). ' +
            'Default days=7 (7 hari kalender setelah hari ini), maksimum 30. Completed, cancelled, deleted, dan todo tanpa dueAt dikecualikan. ' +
            'Mendukung filter tagIds (ANY) dan labelId.',
          security: SECURITY
        }
      }
    )
    .get(
      '/:workspaceId/todos/overdue',
      async ({ params, query, user }) => {
        return await handlers.overdue(user.id, params.workspaceId, query);
      },
      {
        params: workspaceIdParamsSchema,
        query: overdueQuerySchema,
        response: {
          200: listTodosResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Todo'],
          summary: 'Todo Terlambat (Overdue View)',
          description:
            'Todo dengan dueAt < awal hari ini menurut IANA timezone, berstatus selain completed/cancelled, belum dihapus, dan memiliki dueAt. ' +
            'Status tidak diubah otomatis; overdue hanya merupakan hasil perhitungan deadline. Mendukung filter tagIds (ANY) dan labelId.',
          security: SECURITY
        }
      }
    )
    .get(
      '/:workspaceId/todos/:todoId',
      async ({ params, user }) => {
        return await handlers.get(user.id, params.workspaceId, params.todoId);
      },
      {
        params: todoIdParamsSchema,
        response: {
          200: todoResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Todo'],
          summary: 'Detail Todo',
          description:
            'Mengambil satu todo aktif. Todo yang sudah soft-deleted, tidak ada, atau berada di workspace lain diperlakukan sebagai 404.',
          security: SECURITY
        }
      }
    )
    .patch(
      '/:workspaceId/todos/:todoId/complete',
      async ({ params, user }) => {
        return await handlers.complete(user.id, params.workspaceId, params.todoId);
      },
      {
        params: todoIdParamsSchema,
        response: {
          200: todoResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Todo'],
          summary: 'Selesaikan Todo',
          description:
            'Shortcut idempoten untuk mengubah status menjadi completed dan mengisi completedAt dengan waktu server. Pemanggilan ulang tidak menggeser completedAt/updatedAt. Seluruh reminder scheduled Todo dibatalkan secara atomik.',
          security: SECURITY
        }
      }
    )
    .patch(
      '/:workspaceId/todos/:todoId',
      async ({ params, body, user }) => {
        return await handlers.update(user.id, params.workspaceId, params.todoId, body);
      },
      {
        params: todoIdParamsSchema,
        body: updateTodoBodySchema,
        response: {
          200: todoResponseSchema,
          401: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Todo'],
          summary: 'Perbarui Todo',
          description:
            'Memperbarui title/description/status/priority/dueAt/labelId (minimal satu field). null menghapus description, dueAt, atau label. ' +
            'Transisi ke completed mengisi completedAt; transisi keluar dari completed mengosongkannya. Perubahan ke status completed/cancelled membatalkan seluruh reminder scheduled secara atomik. ' +
            'dueAt tidak boleh dikosongkan selama masih ada reminder before_due scheduled, dan perubahan dueAt tidak boleh membuat waktu efektif reminder before_due berada di masa lalu (409). ' +
            'Field internal dan workspace tidak dapat diubah.',
          security: SECURITY
        }
      }
    )
    .delete(
      '/:workspaceId/todos/:todoId',
      async ({ params, user, set }) => {
        await handlers.remove(user.id, params.workspaceId, params.todoId);

        set.status = 204;
        return;
      },
      {
        params: todoIdParamsSchema,
        response: {
          204: t.Void(),
          401: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Todo'],
          summary: 'Hapus Todo (Soft Delete)',
          description:
            'Menandai deletedAt dan updatedAt tanpa menghapus record fisik. Seluruh reminder scheduled dibatalkan secara atomik. Operasi idempoten: mengulang delete tetap 204. Todo terhapus tidak muncul pada listing/detail dan tidak dapat di-update.',
          security: SECURITY
        }
      }
    );
}
