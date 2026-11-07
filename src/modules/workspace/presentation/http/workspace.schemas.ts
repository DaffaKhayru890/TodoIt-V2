import { t } from 'elysia';
import { errorResponseSchema } from '../../../../shared/presentation/http/errors/error-response';

export const workspaceItemSchema = t.Object(
  {
    id: t.String({ format: 'uuid', description: 'ID workspace.' }),
    name: t.String({ description: 'Nama workspace.' }),
    description: t.Nullable(t.String({ description: 'Deskripsi workspace.' })),
    role: t.String({ description: 'Role pengguna dalam workspace.' }),
    createdAt: t.Date({ description: 'Waktu pembuatan workspace.' }),
    updatedAt: t.Date({ description: 'Waktu pembaruan workspace.' }),
    archivedAt: t.Nullable(t.Date({ description: 'Waktu pengarsipan workspace.' }))
  },
  {
    title: 'WorkspaceDetail',
    description: 'Data lengkap entitas workspace.'
  }
);

export const createWorkspaceBodySchema = t.Object(
  {
    name: t.String({
      minLength: 1,
      maxLength: 100,
      description: 'Nama workspace (1-100 karakter).'
    }),
    description: t.Optional(
      t.Nullable(
        t.String({
          maxLength: 500,
          description: 'Deskripsi opsional workspace (maksimal 500 karakter).'
        })
      )
    )
  },
  {
    title: 'CreateWorkspaceInput',
    description: 'Data untuk membuat workspace baru.'
  }
);

export const createWorkspaceResponseSchema = t.Object(
  {
    workspace: workspaceItemSchema
  },
  {
    title: 'CreateWorkspaceResponse',
    description: 'Respons berhasil membuat workspace; pembuat otomatis menjadi owner.'
  }
);

export const listWorkspacesQuerySchema = t.Object({
  limit: t.Optional(
    t.Numeric({
      minimum: 1,
      maximum: 50,
      default: 20,
      description: 'Jumlah item per halaman (1-50, default 20).'
    })
  ),
  offset: t.Optional(
    t.Numeric({
      minimum: 0,
      default: 0,
      description: 'Offset data paginasi (default 0).'
    })
  )
});

export const workspaceListItemSchema = t.Object(
  {
    id: t.String({ format: 'uuid', description: 'ID workspace.' }),
    name: t.String({ description: 'Nama workspace.' }),
    description: t.Nullable(t.String({ description: 'Deskripsi workspace.' })),
    role: t.String({ description: 'Role pengguna dalam workspace.' }),
    createdAt: t.Date({ description: 'Waktu pembuatan workspace.' })
  },
  {
    title: 'WorkspaceListItem',
    description: 'Item ringkasan workspace pada daftar aktif.'
  }
);

export const listWorkspacesResponseSchema = t.Object(
  {
    items: t.Array(workspaceListItemSchema, { description: 'Daftar workspace aktif milik pengguna.' }),
    pagination: t.Object({
      limit: t.Number({ description: 'Limit yang digunakan.' }),
      offset: t.Number({ description: 'Offset yang digunakan.' }),
      total: t.Number({ description: 'Total workspace aktif.' })
    })
  },
  {
    title: 'ListWorkspacesResponse',
    description: 'Daftar workspace pengguna dengan paginasi.'
  }
);

export const workspaceParamSchema = t.Object({
  workspaceId: t.String({
    format: 'uuid',
    description: 'ID unik workspace (UUID).'
  })
});

export const updateWorkspaceBodySchema = t.Object(
  {
    name: t.Optional(
      t.String({
        minLength: 1,
        maxLength: 100,
        description: 'Nama baru workspace (1-100 karakter).'
      })
    ),
    description: t.Optional(
      t.Nullable(
        t.String({
          maxLength: 500,
          description: 'Deskripsi baru workspace (maksimal 500 karakter).'
        })
      )
    )
  },
  {
    title: 'UpdateWorkspaceInput',
    description: 'Field yang dapat diperbarui pada workspace (hanya oleh owner).'
  }
);

export const archiveWorkspaceResponseSchema = t.Object(
  {
    workspace: t.Object({
      id: t.String({ format: 'uuid', description: 'ID workspace yang diarsipkan.' }),
      archivedAt: t.Date({ description: 'Waktu pengarsipan.' })
    })
  },
  {
    title: 'ArchiveWorkspaceResponse',
    description: 'Respons berhasil mengarsipkan workspace secara idempoten.'
  }
);

export { errorResponseSchema };
