import { t } from 'elysia';
import { errorResponseSchema } from '../../../../shared/presentation/http/errors/error-response';
import { paginationSchema } from './todo.schemas';
import { LABEL_COLOR_PATTERN } from '../../domain/value-objects/label-color';

const COLOR_PATTERN = LABEL_COLOR_PATTERN.source;

export const labelIdParamsSchema = t.Object({
  workspaceId: t.String({ format: 'uuid', description: 'ID workspace (UUID).' }),
  labelId: t.String({ format: 'uuid', description: 'ID label (UUID).' })
});

const labelColorField = t.String({
  pattern: COLOR_PATTERN,
  description: 'Warna HEX #RRGGBB, misalnya #3498DB.'
});

const labelDescriptionField = t.Optional(
  t.Nullable(
    t.String({
      maxLength: 300,
      description: 'Deskripsi opsional (maksimal 300 karakter); null menghapus deskripsi.'
    })
  )
);

export const createLabelBodySchema = t.Object(
  {
    name: t.String({
      minLength: 1,
      maxLength: 50,
      description: 'Nama label (1-50 karakter setelah trim). Case-insensitive unique per workspace.'
    }),
    color: labelColorField,
    description: labelDescriptionField
  },
  {
    title: 'CreateLabelInput',
    additionalProperties: false,
    description: 'Metadata internal (id, workspaceId, createdBy, createdAt, updatedAt) berasal dari server.'
  }
);

export const updateLabelBodySchema = t.Object(
  {
    name: t.Optional(
      t.String({
        minLength: 1,
        maxLength: 50,
        description: 'Nama label baru.'
      })
    ),
    color: t.Optional(labelColorField),
    description: labelDescriptionField
  },
  {
    title: 'UpdateLabelInput',
    additionalProperties: false,
    minProperties: 1,
    description: 'Minimal satu field harus diberikan.'
  }
);

export const labelSchema = t.Object(
  {
    id: t.String({ format: 'uuid' }),
    workspaceId: t.String({ format: 'uuid' }),
    name: t.String({ description: 'Nama label sesuai input, sudah di-trim.' }),
    color: t.String({ description: 'Warna HEX uppercase #RRGGBB.' }),
    description: t.Nullable(t.String({ description: 'Deskripsi label.' })),
    createdAt: t.Date(),
    updatedAt: t.Date()
  },
  { title: 'Label', description: 'Label workspace-scoped.' }
);

export const labelResponseSchema = t.Object(
  { label: labelSchema },
  { title: 'LabelResponse', description: 'Detail satu label.' }
);

export const listLabelsQuerySchema = t.Object({
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
      description: 'Pencarian case-insensitive pada nama label.'
    })
  )
});

export const listLabelsResponseSchema = t.Object(
  {
    items: t.Array(labelSchema, { description: 'Label pada halaman ini.' }),
    pagination: paginationSchema
  },
  { title: 'ListLabelsResponse', description: 'Daftar label dengan cursor pagination.' }
);

export const assignTodoLabelBodySchema = t.Object(
  {
    labelId: t.String({
      format: 'uuid',
      description: 'ID label pada workspace yang sama.'
    })
  },
  {
    title: 'AssignTodoLabelInput',
    additionalProperties: false,
    description: 'Memasang satu label utama pada todo; label sebelumnya diganti.'
  }
);

export { errorResponseSchema };
