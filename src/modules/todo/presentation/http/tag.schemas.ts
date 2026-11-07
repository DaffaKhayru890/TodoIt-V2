import { t } from 'elysia';
import { errorResponseSchema } from '../../../../shared/presentation/http/errors/error-response';
import { paginationSchema, todoTagSummarySchema } from './todo.schemas';

export const tagIdParamsSchema = t.Object({
  workspaceId: t.String({ format: 'uuid', description: 'ID workspace (UUID).' }),
  tagId: t.String({ format: 'uuid', description: 'ID tag (UUID).' })
});

export const todoTagParamsSchema = t.Object({
  workspaceId: t.String({ format: 'uuid', description: 'ID workspace (UUID).' }),
  todoId: t.String({ format: 'uuid', description: 'ID todo (UUID).' }),
  tagId: t.String({ format: 'uuid', description: 'ID tag (UUID).' })
});

export const createTagBodySchema = t.Object(
  {
    name: t.String({
      minLength: 1,
      maxLength: 50,
      description: 'Nama tag (1-50 karakter setelah trim). Case-insensitive unique per workspace.'
    })
  },
  {
    title: 'CreateTagInput',
    additionalProperties: false,
    description: 'Metadata internal (id, workspaceId, createdBy, createdAt, updatedAt) berasal dari server.'
  }
);

export const updateTagBodySchema = t.Object(
  {
    name: t.String({
      minLength: 1,
      maxLength: 50,
      description: 'Nama tag baru (1-50 karakter setelah trim).'
    })
  },
  {
    title: 'UpdateTagInput',
    additionalProperties: false,
    minProperties: 1,
    description: 'Minimal satu field harus diberikan; hanya name yang dapat diubah.'
  }
);

export const tagSchema = t.Object(
  {
    id: t.String({ format: 'uuid' }),
    workspaceId: t.String({ format: 'uuid' }),
    name: t.String({ description: 'Nama tag sesuai input, sudah di-trim.' }),
    createdAt: t.Date(),
    updatedAt: t.Date()
  },
  { title: 'Tag', description: 'Tag workspace-scoped.' }
);

export const tagResponseSchema = t.Object(
  { tag: tagSchema },
  { title: 'TagResponse', description: 'Detail satu tag.' }
);

export const listTagsQuerySchema = t.Object({
  limit: t.Optional(
    t.Numeric({
      minimum: 1,
      maximum: 100,
      default: 20,
      description: 'Jumlah item per halaman (1-100, default 20).'
    })
  ),
  cursor: t.Optional(
    t.String({
      maxLength: 2048,
      description: 'Cursor opaque dari pagination.nextCursor halaman sebelumnya.'
    })
  ),
  q: t.Optional(
    t.String({
      maxLength: 50,
      description: 'Pencarian case-insensitive pada nama tag.'
    })
  )
});

export const listTagsResponseSchema = t.Object(
  {
    items: t.Array(tagSchema, { description: 'Tag pada halaman ini.' }),
    pagination: paginationSchema
  },
  { title: 'ListTagsResponse', description: 'Daftar tag dengan cursor pagination.' }
);

export const replaceTodoTagsBodySchema = t.Object(
  {
    tagIds: t.Array(
      t.String({ format: 'uuid', description: 'ID tag pada workspace yang sama.' }),
      {
        description:
          'Daftar lengkap tag untuk todo. Array kosong menghapus semua tag. Duplikat dinormalisasi; maksimal 20.'
      }
    )
  },
  {
    title: 'ReplaceTodoTagsInput',
    additionalProperties: false,
    description: 'Mengganti seluruh association tag Todo secara atomik.'
  }
);

export const todoTagsResponseSchema = t.Object(
  {
    tags: t.Array(todoTagSummarySchema, {
      description: 'Tag yang saat ini melekat pada todo.'
    })
  },
  { title: 'TodoTagsResponse', description: 'Ringkasan tag pada satu todo.' }
);

export { errorResponseSchema };
