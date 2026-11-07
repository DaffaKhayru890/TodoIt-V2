import { Elysia, t } from 'elysia';
import type { GetCurrentUser } from '../../../auth/application/use-cases/get-current-user';
import { createAuthGuard } from '../../../auth/presentation/http/auth.middleware';
import type { CreateLabel } from '../../application/use-cases/label/create-label';
import type { ListLabels } from '../../application/use-cases/label/list-labels';
import type { GetLabel } from '../../application/use-cases/label/get-label';
import type { UpdateLabel } from '../../application/use-cases/label/update-label';
import type { DeleteLabel } from '../../application/use-cases/label/delete-label';
import type { AssignTodoLabel } from '../../application/use-cases/label/assign-todo-label';
import type { ClearTodoLabel } from '../../application/use-cases/label/clear-todo-label';
import { createLabelHandlers } from './label.handlers';
import {
  assignTodoLabelBodySchema,
  createLabelBodySchema,
  errorResponseSchema,
  labelIdParamsSchema,
  labelResponseSchema,
  listLabelsQuerySchema,
  listLabelsResponseSchema,
  updateLabelBodySchema
} from './label.schemas';
import { todoIdParamsSchema, todoResponseSchema } from './todo.schemas';

export interface LabelRoutesDependencies {
  readonly getCurrentUser: GetCurrentUser;
  readonly createLabel: CreateLabel;
  readonly listLabels: ListLabels;
  readonly getLabel: GetLabel;
  readonly updateLabel: UpdateLabel;
  readonly deleteLabel: DeleteLabel;
  readonly assignTodoLabel: AssignTodoLabel;
  readonly clearTodoLabel: ClearTodoLabel;
}

const SECURITY = [{ bearerAuth: [] }];

/**
 * Route Label dan assignment Label pada Todo. Tanpa `prefix` karena dipasang di
 * bawah `createTodoRoutes`.
 */
export function createLabelRoutes(deps: LabelRoutesDependencies) {
  const handlers = createLabelHandlers(deps);

  return new Elysia()
    .use(createAuthGuard(deps.getCurrentUser))
    .post(
      '/:workspaceId/labels',
      async ({ params, body, user, set }) => {
        const result = await handlers.create(user.id, params.workspaceId, body);

        set.status = 201;
        return result;
      },
      {
        params: t.Object({ workspaceId: t.String({ format: 'uuid' }) }),
        body: createLabelBodySchema,
        response: {
          201: labelResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Label'],
          summary: 'Buat Label',
          description:
            'Membuat label workspace-scoped dengan warna `#RRGGBB` dan deskripsi opsional maksimal 300 karakter. Nama unik case-insensitive per workspace. Hanya owner/admin.',
          security: SECURITY
        }
      }
    )
    .get(
      '/:workspaceId/labels',
      async ({ params, query, user }) => {
        return await handlers.list(user.id, params.workspaceId, query);
      },
      {
        params: t.Object({ workspaceId: t.String({ format: 'uuid' }) }),
        query: listLabelsQuerySchema,
        response: {
          200: listLabelsResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Label'],
          summary: 'Daftar Label',
          description:
            'Daftar label workspace dengan cursor pagination dan pencarian nama case-insensitive. Semua member boleh melihat.',
          security: SECURITY
        }
      }
    )
    .get(
      '/:workspaceId/labels/:labelId',
      async ({ params, user }) => {
        return await handlers.get(user.id, params.workspaceId, params.labelId);
      },
      {
        params: labelIdParamsSchema,
        response: {
          200: labelResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Label'],
          summary: 'Detail Label',
          description: 'Mengambil satu label pada workspace yang diakses.',
          security: SECURITY
        }
      }
    )
    .patch(
      '/:workspaceId/labels/:labelId',
      async ({ params, body, user }) => {
        return await handlers.update(user.id, params.workspaceId, params.labelId, body);
      },
      {
        params: labelIdParamsSchema,
        body: updateLabelBodySchema,
        response: {
          200: labelResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Label'],
          summary: 'Perbarui Label',
          description:
            'Mengubah name/color/description (minimal satu field). `description: null` menghapus deskripsi. Hanya owner/admin.',
          security: SECURITY
        }
      }
    )
    .delete(
      '/:workspaceId/labels/:labelId',
      async ({ params, user, set }) => {
        await handlers.remove(user.id, params.workspaceId, params.labelId);

        set.status = 204;
        return;
      },
      {
        params: labelIdParamsSchema,
        response: {
          204: t.Void(),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Label'],
          summary: 'Hapus Label (Hard Delete)',
          description:
            'Menghapus label secara permanen. `todos.label_id` yang mereferensikan label menjadi NULL melalui ON DELETE SET NULL; Todo tidak ikut terhapus. Hanya owner/admin.',
          security: SECURITY
        }
      }
    )
    .put(
      '/:workspaceId/todos/:todoId/label',
      async ({ params, body, user }) => {
        const todo = await deps.assignTodoLabel.execute({
          workspaceId: params.workspaceId,
          userId: user.id,
          todoId: params.todoId,
          labelId: body.labelId
        });

        return { todo };
      },
      {
        params: todoIdParamsSchema,
        body: assignTodoLabelBodySchema,
        response: {
          200: todoResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Label'],
          summary: 'Pasang Label pada Todo',
          description:
            'Memasang satu label utama pada Todo; label sebelumnya diganti. Satu Todo maksimal memiliki satu label. Semua member boleh melakukan assignment.',
          security: SECURITY
        }
      }
    )
    .delete(
      '/:workspaceId/todos/:todoId/label',
      async ({ params, user }) => {
        const todo = await deps.clearTodoLabel.execute({
          workspaceId: params.workspaceId,
          userId: user.id,
          todoId: params.todoId
        });

        return { todo };
      },
      {
        params: todoIdParamsSchema,
        response: {
          200: todoResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Label'],
          summary: 'Lepas Label dari Todo',
          description:
            'Menghapus label utama dari Todo. Operasi idempoten: memanggil saat Todo tanpa label tetap 200.',
          security: SECURITY
        }
      }
    );
}
