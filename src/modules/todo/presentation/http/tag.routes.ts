import { Elysia, t } from 'elysia';
import type { GetCurrentUser } from '../../../auth/application/use-cases/get-current-user';
import { createAuthGuard } from '../../../auth/presentation/http/auth.middleware';
import type { CreateTag } from '../../application/use-cases/tag/create-tag';
import type { ListTags } from '../../application/use-cases/tag/list-tags';
import type { GetTag } from '../../application/use-cases/tag/get-tag';
import type { UpdateTag } from '../../application/use-cases/tag/update-tag';
import type { DeleteTag } from '../../application/use-cases/tag/delete-tag';
import type { ReplaceTodoTags } from '../../application/use-cases/tag/replace-todo-tags';
import type { AddTodoTag } from '../../application/use-cases/tag/add-todo-tag';
import type { RemoveTodoTag } from '../../application/use-cases/tag/remove-todo-tag';
import { createTagHandlers } from './tag.handlers';
import {
  createTagBodySchema,
  errorResponseSchema,
  listTagsQuerySchema,
  listTagsResponseSchema,
  replaceTodoTagsBodySchema,
  tagIdParamsSchema,
  tagResponseSchema,
  todoTagParamsSchema,
  todoTagsResponseSchema,
  updateTagBodySchema
} from './tag.schemas';
import { todoIdParamsSchema } from './todo.schemas';

export interface TagRoutesDependencies {
  readonly getCurrentUser: GetCurrentUser;
  readonly createTag: CreateTag;
  readonly listTags: ListTags;
  readonly getTag: GetTag;
  readonly updateTag: UpdateTag;
  readonly deleteTag: DeleteTag;
  readonly replaceTodoTags: ReplaceTodoTags;
  readonly addTodoTag: AddTodoTag;
  readonly removeTodoTag: RemoveTodoTag;
}

const SECURITY = [{ bearerAuth: [] }];

/**
 * Route Tag dan assignment Tag pada Todo. Instance ini sengaja tanpa `prefix`
 * karena dipasang sebagai plugin di bawah `createTodoRoutes` yang sudah memiliki
 * prefix `/api/v1/workspaces`.
 */
export function createTagRoutes(deps: TagRoutesDependencies) {
  const handlers = createTagHandlers(deps);

  return new Elysia()
    .use(createAuthGuard(deps.getCurrentUser))
    .post(
      '/:workspaceId/tags',
      async ({ params, body, user, set }) => {
        const result = await handlers.create(user.id, params.workspaceId, body);

        set.status = 201;
        return result;
      },
      {
        params: t.Object({ workspaceId: t.String({ format: 'uuid' }) }),
        body: createTagBodySchema,
        response: {
          201: tagResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Tag'],
          summary: 'Buat Tag',
          description:
            'Membuat tag workspace-scoped. Nama di-trim dan dibandingkan case-insensitive; duplikat menghasilkan 409. Hanya owner/admin yang boleh mengelola tag.',
          security: SECURITY
        }
      }
    )
    .get(
      '/:workspaceId/tags',
      async ({ params, query, user }) => {
        return await handlers.list(user.id, params.workspaceId, query);
      },
      {
        params: t.Object({ workspaceId: t.String({ format: 'uuid' }) }),
        query: listTagsQuerySchema,
        response: {
          200: listTagsResponseSchema,
          400: errorResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Tag'],
          summary: 'Daftar Tag',
          description:
            'Daftar tag workspace dengan cursor pagination `ORDER BY created_at DESC, id DESC`, opsional pencarian case-insensitive pada nama. Semua member boleh melihat.',
          security: SECURITY
        }
      }
    )
    .get(
      '/:workspaceId/tags/:tagId',
      async ({ params, user }) => {
        return await handlers.get(user.id, params.workspaceId, params.tagId);
      },
      {
        params: tagIdParamsSchema,
        response: {
          200: tagResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Tag'],
          summary: 'Detail Tag',
          description:
            'Mengambil satu tag. Tag dari workspace lain atau yang tidak ada diperlakukan sebagai 404.',
          security: SECURITY
        }
      }
    )
    .patch(
      '/:workspaceId/tags/:tagId',
      async ({ params, body, user }) => {
        return await handlers.update(user.id, params.workspaceId, params.tagId, body);
      },
      {
        params: tagIdParamsSchema,
        body: updateTagBodySchema,
        response: {
          200: tagResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Tag'],
          summary: 'Perbarui Tag',
          description:
            'Mengubah nama tag. Hanya owner/admin. Nama baru tetap unik case-insensitive per workspace.',
          security: SECURITY
        }
      }
    )
    .delete(
      '/:workspaceId/tags/:tagId',
      async ({ params, user, set }) => {
        await handlers.remove(user.id, params.workspaceId, params.tagId);

        set.status = 204;
        return;
      },
      {
        params: tagIdParamsSchema,
        response: {
          204: t.Void(),
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Tag'],
          summary: 'Hapus Tag (Hard Delete)',
          description:
            'Menghapus tag secara permanen. Seluruh association `todo_tags` ikut terhapus melalui ON DELETE CASCADE; Todo tetap ada. Hanya owner/admin.',
          security: SECURITY
        }
      }
    )
    .put(
      '/:workspaceId/todos/:todoId/tags',
      async ({ params, body, user }) => {
        return await handlers.replaceTodoTags(
          user.id,
          params.workspaceId,
          params.todoId,
          body
        );
      },
      {
        params: todoIdParamsSchema,
        body: replaceTodoTagsBodySchema,
        response: {
          200: todoTagsResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Tag'],
          summary: 'Ganti Seluruh Tag Todo',
          description:
            'Mengganti association tag Todo secara atomik. Array kosong menghapus semua tag. Duplikat dinormalisasi dan maksimal 20 tag per Todo. Semua tag harus berada pada workspace yang sama. Semua member boleh melakukan assignment.',
          security: SECURITY
        }
      }
    )
    .post(
      '/:workspaceId/todos/:todoId/tags/:tagId',
      async ({ params, user }) => {
        return await handlers.addTodoTag(
          user.id,
          params.workspaceId,
          params.todoId,
          params.tagId
        );
      },
      {
        params: todoTagParamsSchema,
        response: {
          200: todoTagsResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          409: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Tag'],
          summary: 'Pasang Tag pada Todo',
          description:
            'Menambahkan satu tag ke Todo. Operasi idempoten: memasang tag yang sudah terpasang tetap 200 tanpa mengubah association. Maksimal 20 tag per Todo.',
          security: SECURITY
        }
      }
    )
    .delete(
      '/:workspaceId/todos/:todoId/tags/:tagId',
      async ({ params, user }) => {
        return await handlers.removeTodoTag(
          user.id,
          params.workspaceId,
          params.todoId,
          params.tagId
        );
      },
      {
        params: todoTagParamsSchema,
        response: {
          200: todoTagsResponseSchema,
          401: errorResponseSchema,
          403: errorResponseSchema,
          404: errorResponseSchema,
          422: errorResponseSchema
        },
        detail: {
          tags: ['Tag'],
          summary: 'Lepas Tag dari Todo',
          description:
            'Melepas satu tag dari Todo. Operasi idempoten: melepas tag yang tidak terpasang tetap 200 dan mengembalikan daftar tag terkini.',
          security: SECURITY
        }
      }
    );
}
