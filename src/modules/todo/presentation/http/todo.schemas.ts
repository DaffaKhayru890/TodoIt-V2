import { t } from 'elysia';
import { TODO_PRIORITIES } from '../../domain/enums/todo-priority';
import { TODO_STATUSES } from '../../domain/enums/todo-status';
import { EXPLICIT_ISO_INSTANT_PATTERN } from '../../application/services/instant-parser';
import { errorResponseSchema } from '../../../../shared/presentation/http/errors/error-response';

const ISO_PATTERN = EXPLICIT_ISO_INSTANT_PATTERN.source;

export const todoStatusSchema = t.String({
  enum: [...TODO_STATUSES],
  description: 'Status todo: todo, in_progress, completed, atau cancelled.'
});

export const todoPrioritySchema = t.String({
  enum: [...TODO_PRIORITIES],
  description: 'Prioritas todo: low, medium, high, atau urgent.'
});

export const todoLabelSummarySchema = t.Object(
  {
    id: t.String({ format: 'uuid', description: 'ID label.' }),
    name: t.String({ description: 'Nama label.' }),
    color: t.String({ description: 'Warna label dalam format #RRGGBB.' })
  },
  { title: 'TodoLabel', description: 'Ringkasan label utama yang melekat pada todo.' }
);

export const todoTagSummarySchema = t.Object(
  {
    id: t.String({ format: 'uuid', description: 'ID tag.' }),
    name: t.String({ description: 'Nama tag.' })
  },
  { title: 'TodoTag', description: 'Ringkasan tag yang melekat pada todo.' }
);

const UUID_QUERY_PATTERN =
  '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';

export const tagIdsQuerySchema = t.Optional(
  t.Array(
    t.String({
      pattern: UUID_QUERY_PATTERN,
      description: 'ID tag (UUID). Boleh diulang: ?tagIds=a&tagIds=b. Semantics ANY.'
    }),
    {
      description:
        'Filter tag dengan semantics ANY: todo ditampilkan bila memiliki minimal satu tag dari daftar.'
    }
  )
);

export const labelIdQuerySchema = t.Optional(
  t.String({
    pattern: UUID_QUERY_PATTERN,
    description: 'Filter todo yang memiliki label tertentu.'
  })
);

export const todoSchema = t.Object(
  {
    id: t.String({ format: 'uuid', description: 'ID unik todo.' }),
    workspaceId: t.String({ format: 'uuid', description: 'Workspace pemilik todo.' }),
    title: t.String({ description: 'Judul todo (1-200 karakter setelah trim).' }),
    description: t.Nullable(t.String({ description: 'Deskripsi todo (maksimal 5000 karakter).' })),
    status: todoStatusSchema,
    priority: todoPrioritySchema,
    dueAt: t.Nullable(t.Date({ description: 'Deadline todo dalam instant UTC (ISO 8601 saat serialisasi).' })),
    completedAt: t.Nullable(t.Date({ description: 'Waktu penyelesaian; hanya terisi saat status completed.' })),
    label: t.Nullable(todoLabelSummarySchema),
    tags: t.Array(todoTagSummarySchema, { description: 'Tag yang melekat pada todo.' }),
    createdBy: t.String({ format: 'uuid', description: 'User yang membuat todo.' }),
    createdAt: t.Date({ description: 'Waktu pembuatan todo.' }),
    updatedAt: t.Date({ description: 'Waktu pembaruan todo.' })
  },
  {
    title: 'Todo',
    description:
      'Representasi todo aktif beserta metadata label dan tag. deletedAt tidak pernah dikirim karena todo terhapus diperlakukan sebagai tidak ada.'
  }
);

export const workspaceIdParamsSchema = t.Object({
  workspaceId: t.String({ format: 'uuid', description: 'ID workspace (UUID).' })
});

export const todoIdParamsSchema = t.Object({
  workspaceId: t.String({ format: 'uuid', description: 'ID workspace (UUID).' }),
  todoId: t.String({ format: 'uuid', description: 'ID todo (UUID).' })
});

const dueAtField = t.Optional(
  t.Nullable(
    t.String({
      pattern: ISO_PATTERN,
      description:
        'Deadline ISO 8601 dengan timezone eksplisit (mis. 2026-11-10T09:00:00+07:00 atau ...Z). null menghapus deadline.'
    })
  )
);

export const createTodoBodySchema = t.Object(
  {
    title: t.String({
      minLength: 1,
      maxLength: 200,
      description: 'Judul todo (wajib, 1-200 karakter setelah trim).'
    }),
    description: t.Optional(
      t.Nullable(
        t.String({
          maxLength: 5000,
          description: 'Deskripsi opsional (maksimal 5000 karakter).'
        })
      )
    ),
    priority: t.Optional(
      t.String({
        enum: [...TODO_PRIORITIES],
        description: 'Prioritas; default low bila tidak diberikan.'
      })
    ),
    dueAt: dueAtField
  },
  {
    title: 'CreateTodoInput',
    additionalProperties: false,
    description:
      'Data pembuatan todo. id, workspaceId, createdBy, createdAt, updatedAt, deletedAt, dan status tidak dapat ditentukan client.'
  }
);

export const updateTodoBodySchema = t.Object(
  {
    title: t.Optional(
      t.String({
        minLength: 1,
        maxLength: 200,
        description: 'Judul baru (tidak boleh kosong setelah trim).'
      })
    ),
    description: t.Optional(
      t.Nullable(
        t.String({
          maxLength: 5000,
          description: 'Deskripsi baru; null menghapus deskripsi.'
        })
      )
    ),
    status: t.Optional(
      t.String({
        enum: [...TODO_STATUSES],
        description: 'Status baru. completed mengisi completedAt; status lain mengosongkannya.'
      })
    ),
    priority: t.Optional(
      t.String({
        enum: [...TODO_PRIORITIES],
        description: 'Prioritas baru.'
      })
    ),
    dueAt: dueAtField,
    labelId: t.Optional(
      t.Nullable(
        t.String({
          format: 'uuid',
          description: 'ID label pada workspace yang sama; null menghapus label.'
        })
      )
    )
  },
  {
    title: 'UpdateTodoInput',
    additionalProperties: false,
    minProperties: 1,
    description:
      'Minimal satu field harus diberikan. Field internal (id, workspaceId, createdBy, createdAt, updatedAt, deletedAt) ditolak. labelId null menghapus label.'
  }
);

export const createTodoResponseSchema = t.Object(
  { todo: todoSchema },
  {
    title: 'CreateTodoResponse',
    description: 'Todo yang berhasil dibuat; status awal selalu todo dan createdBy berasal dari token.'
  }
);

export const todoResponseSchema = t.Object(
  { todo: todoSchema },
  { title: 'TodoResponse', description: 'Detail satu todo aktif.' }
);

export const listTodosQuerySchema = t.Object({
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
  status: t.Optional(t.String({ enum: [...TODO_STATUSES], description: 'Filter status.' })),
  priority: t.Optional(t.String({ enum: [...TODO_PRIORITIES], description: 'Filter prioritas.' })),
  dueFrom: t.Optional(
    t.String({ pattern: ISO_PATTERN, description: 'Batas bawah dueAt (inclusive), ISO 8601 dengan timezone.' })
  ),
  dueTo: t.Optional(
    t.String({ pattern: ISO_PATTERN, description: 'Batas atas dueAt (inclusive), ISO 8601 dengan timezone.' })
  ),
  createdFrom: t.Optional(
    t.String({ pattern: ISO_PATTERN, description: 'Batas bawah createdAt (inclusive), ISO 8601 dengan timezone.' })
  ),
  createdTo: t.Optional(
    t.String({ pattern: ISO_PATTERN, description: 'Batas atas createdAt (inclusive), ISO 8601 dengan timezone.' })
  ),
  q: t.Optional(
    t.String({
      maxLength: 200,
      description: 'Pencarian case-insensitive pada title dan description. Wildcard % dan _ diperlakukan literal.'
    })
  ),
  tagIds: tagIdsQuerySchema,
  labelId: labelIdQuerySchema
});

export const todayQuerySchema = t.Object({
  timezone: t.Optional(
    t.String({
      maxLength: 64,
      description: 'IANA timezone (mis. Asia/Jakarta). Default dari APP_DEFAULT_TIMEZONE (UTC).'
    })
  ),
  includeCompleted: t.Optional(
    t.BooleanString({
      default: false,
      description: 'true menyertakan todo completed; todo cancelled tetap dikecualikan.'
    })
  ),
  limit: t.Optional(
    t.Numeric({ minimum: 1, maximum: 100, default: 20, description: 'Jumlah item per halaman.' })
  ),
  cursor: t.Optional(t.String({ maxLength: 2048, description: 'Cursor opaque dari halaman sebelumnya.' })),
  tagIds: tagIdsQuerySchema,
  labelId: labelIdQuerySchema
});

export const upcomingQuerySchema = t.Object({
  timezone: t.Optional(
    t.String({
      maxLength: 64,
      description: 'IANA timezone. Default dari APP_DEFAULT_TIMEZONE (UTC).'
    })
  ),
  days: t.Optional(
    t.Numeric({
      minimum: 1,
      maximum: 30,
      default: 7,
      description: 'Jumlah hari kalender setelah hari ini (1-30, default 7).'
    })
  ),
  limit: t.Optional(
    t.Numeric({ minimum: 1, maximum: 100, default: 20, description: 'Jumlah item per halaman.' })
  ),
  cursor: t.Optional(t.String({ maxLength: 2048, description: 'Cursor opaque dari halaman sebelumnya.' })),
  tagIds: tagIdsQuerySchema,
  labelId: labelIdQuerySchema
});

export const overdueQuerySchema = t.Object({
  timezone: t.Optional(
    t.String({
      maxLength: 64,
      description: 'IANA timezone. Default dari APP_DEFAULT_TIMEZONE (UTC).'
    })
  ),
  limit: t.Optional(
    t.Numeric({ minimum: 1, maximum: 100, default: 20, description: 'Jumlah item per halaman.' })
  ),
  cursor: t.Optional(t.String({ maxLength: 2048, description: 'Cursor opaque dari halaman sebelumnya.' })),
  tagIds: tagIdsQuerySchema,
  labelId: labelIdQuerySchema
});

export const paginationSchema = t.Object(
  {
    limit: t.Number({ description: 'Limit yang benar-benar dipakai.' }),
    hasMore: t.Boolean({ description: 'true bila masih ada halaman berikutnya.' }),
    nextCursor: t.Nullable(
      t.String({ description: 'Cursor opaque untuk halaman berikutnya; null bila sudah habis.' })
    )
  },
  { title: 'CursorPagination', description: 'Metadata keyset pagination tanpa total count.' }
);

export const listTodosResponseSchema = t.Object(
  {
    items: t.Array(todoSchema, { description: 'Todo pada halaman ini.' }),
    pagination: paginationSchema
  },
  { title: 'ListTodosResponse', description: 'Daftar todo dengan cursor pagination.' }
);

export { errorResponseSchema };
