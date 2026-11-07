import { Elysia, t } from 'elysia';
import type { GetCurrentUser } from '../../../auth/application/use-cases/get-current-user';
import { createAuthGuard } from '../../../auth/presentation/http/auth.middleware';
import type { CreateReminder } from '../../application/use-cases/reminder/create-reminder';
import type { ListTodoReminders } from '../../application/use-cases/reminder/list-todo-reminders';
import type { GetReminder } from '../../application/use-cases/reminder/get-reminder';
import type { UpdateReminder } from '../../application/use-cases/reminder/update-reminder';
import type { CancelReminder } from '../../application/use-cases/reminder/cancel-reminder';
import { createReminderHandlers } from './reminder.handlers';
import {
  createReminderBodySchema,
  errorResponseSchema,
  listRemindersQuerySchema,
  listRemindersResponseSchema,
  reminderParamsSchema,
  reminderResponseSchema,
  todoReminderParamsSchema,
  updateReminderBodySchema
} from './reminder.schemas';

export interface ReminderRoutesDependencies {
  readonly getCurrentUser: GetCurrentUser;
  readonly createReminder: CreateReminder;
  readonly listTodoReminders: ListTodoReminders;
  readonly getReminder: GetReminder;
  readonly updateReminder: UpdateReminder;
  readonly cancelReminder: CancelReminder;
}

const SECURITY = [{ bearerAuth: [] }];

/**
 * Route Reminder di bawah satu Todo. Tanpa `prefix` karena dipasang sebagai
 * plugin di `createTodoRoutes`.
 */
export function createReminderRoutes(deps: ReminderRoutesDependencies) {
  const handlers = createReminderHandlers(deps);

  return new Elysia()
    .use(createAuthGuard(deps.getCurrentUser))
    .post(
      '/:workspaceId/todos/:todoId/reminders',
      async ({ params, body, user, set }) => {
        const result = await handlers.create(
          user.id,
          params.workspaceId,
          params.todoId,
          body
        );

        set.status = 201;
        return result;
      },
      {
        params: todoReminderParamsSchema,
        body: createReminderBodySchema,
        response: {
          201: reminderResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Reminder'],
          summary: 'Buat Reminder',
          description:
            'Membuat reminder untuk Todo aktif. `absolute` membutuhkan remindAt di masa depan; `before_due` membutuhkan dueAt pada Todo dan offsetMinutes 1-43200 sehingga waktu efektifnya berada di masa depan. Jadwal scheduled yang sama untuk Todo yang sama ditolak 409. Tidak ada pengiriman notifikasi pada fase ini.',
          security: SECURITY
        }
      }
    )
    .get(
      '/:workspaceId/todos/:todoId/reminders',
      async ({ params, query, user }) => {
        return await handlers.list(user.id, params.workspaceId, params.todoId, query);
      },
      {
        params: todoReminderParamsSchema,
        query: listRemindersQuerySchema,
        response: {
          200: listRemindersResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Reminder'],
          summary: 'Daftar Reminder Todo',
          description:
            'Daftar reminder dengan urutan effectiveAt ASC (NULLS LAST) dan id sebagai tie-breaker. Status default scheduled; gunakan `status=all` untuk melihat reminder cancelled. effectiveAt dihitung dinamis dari remindAt atau dueAt - offsetMinutes.',
          security: SECURITY
        }
      }
    )
    .get(
      '/:workspaceId/todos/:todoId/reminders/:reminderId',
      async ({ params, user }) => {
        return await handlers.get(
          user.id,
          params.workspaceId,
          params.todoId,
          params.reminderId
        );
      },
      {
        params: reminderParamsSchema,
        response: {
          200: reminderResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Reminder'],
          summary: 'Detail Reminder',
          description:
            'Mengambil satu reminder milik Todo pada workspace yang diakses. Reminder Todo lain atau workspace lain diperlakukan 404.',
          security: SECURITY
        }
      }
    )
    .patch(
      '/:workspaceId/todos/:todoId/reminders/:reminderId',
      async ({ params, body, user }) => {
        return await handlers.update(
          user.id,
          params.workspaceId,
          params.todoId,
          params.reminderId,
          body
        );
      },
      {
        params: reminderParamsSchema,
        body: updateReminderBodySchema,
        response: {
          200: reminderResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Reminder'],
          summary: 'Ubah Jadwal Reminder',
          description:
            'Trigger type immutable: reminder absolute hanya boleh mengubah remindAt, before_due hanya offsetMinutes. Waktu efektif baru harus berada di masa depan. Reminder cancelled tidak dapat diubah (409).',
          security: SECURITY
        }
      }
    )
    .delete(
      '/:workspaceId/todos/:todoId/reminders/:reminderId',
      async ({ params, user, set }) => {
        await handlers.cancel(
          user.id,
          params.workspaceId,
          params.todoId,
          params.reminderId
        );

        set.status = 204;
        return;
      },
      {
        params: reminderParamsSchema,
        response: {
          204: t.Void(),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Reminder'],
          summary: 'Batalkan Reminder',
          description:
            'Membatalkan reminder (status cancelled, cancelledAt diisi server). Operasi idempoten; reminder tidak dihapus permanen. Reminder cancelled tidak pernah diaktifkan kembali.',
          security: SECURITY
        }
      }
    );
}
