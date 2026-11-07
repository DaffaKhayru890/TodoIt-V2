import { t } from 'elysia';
import { errorResponseSchema } from '../../../../shared/presentation/http/errors/error-response';
import { EXPLICIT_ISO_INSTANT_PATTERN } from '../../application/services/instant-parser';
import { REMINDER_STATUSES } from '../../domain/enums/reminder-status';
import { REMINDER_TRIGGER_TYPES } from '../../domain/enums/reminder-trigger-type';
import { paginationSchema } from './todo.schemas';

const ISO_PATTERN = EXPLICIT_ISO_INSTANT_PATTERN.source;

export const todoReminderParamsSchema = t.Object({
  workspaceId: t.String({ format: 'uuid', description: 'ID workspace (UUID).' }),
  todoId: t.String({ format: 'uuid', description: 'ID todo (UUID).' })
});

export const reminderParamsSchema = t.Object({
  workspaceId: t.String({ format: 'uuid', description: 'ID workspace (UUID).' }),
  todoId: t.String({ format: 'uuid', description: 'ID todo (UUID).' }),
  reminderId: t.String({ format: 'uuid', description: 'ID reminder (UUID).' })
});

export const reminderTriggerTypeSchema = t.String({
  enum: [...REMINDER_TRIGGER_TYPES],
  description: 'absolute memakai remindAt; before_due memakai offsetMinutes dari dueAt todo.'
});

export const reminderStatusSchema = t.String({
  enum: [...REMINDER_STATUSES],
  description: 'scheduled siap diproses Notification Engine; cancelled tidak boleh diproses lagi.'
});

const remindAtField = t.Optional(
  t.Nullable(
    t.String({
      pattern: ISO_PATTERN,
      description:
        'Waktu absolut ISO 8601 dengan timezone eksplisit. Wajib untuk triggerType absolute dan harus di masa depan.'
    })
  )
);

const offsetMinutesField = t.Optional(
  t.Nullable(
    t.Integer({
      minimum: 1,
      maximum: 43_200,
      description:
        'Offset menit sebelum dueAt (1-43200). Wajib untuk triggerType before_due dan tidak boleh untuk absolute.'
    })
  )
);

export const createReminderBodySchema = t.Object(
  {
    triggerType: reminderTriggerTypeSchema,
    remindAt: remindAtField,
    offsetMinutes: offsetMinutesField
  },
  {
    title: 'CreateReminderInput',
    additionalProperties: false,
    description:
      'Untuk absolute: triggerType + remindAt. Untuk before_due: triggerType + offsetMinutes. Kombinasi field divalidasi application layer.'
  }
);

export const updateReminderBodySchema = t.Object(
  {
    remindAt: t.Optional(
      t.String({
        pattern: ISO_PATTERN,
        description:
          'Waktu absolut baru (ISO 8601 dengan timezone eksplisit) untuk reminder absolute; harus di masa depan.'
      })
    ),
    offsetMinutes: t.Optional(
      t.Integer({
        minimum: 1,
        maximum: 43_200,
        description: 'Offset menit baru untuk reminder before_due (1-43200).'
      })
    )
  },
  {
    title: 'UpdateReminderInput',
    additionalProperties: false,
    minProperties: 1,
    description:
      'Trigger type immutable. Absolute hanya boleh mengubah remindAt; before_due hanya boleh mengubah offsetMinutes.'
  }
);

export const reminderSchema = t.Object(
  {
    id: t.String({ format: 'uuid' }),
    todoId: t.String({ format: 'uuid' }),
    triggerType: reminderTriggerTypeSchema,
    remindAt: t.Nullable(
      t.Date({ description: 'Waktu absolut; hanya terisi untuk trigger absolute.' })
    ),
    offsetMinutes: t.Nullable(
      t.Integer({ description: 'Offset menit; hanya terisi untuk trigger before_due.' })
    ),
    effectiveAt: t.Nullable(
      t.Date({
        description:
          'Waktu efektif: remindAt untuk absolute, atau dueAt - offsetMinutes untuk before_due. Dihitung dinamis.'
      })
    ),
    status: reminderStatusSchema,
    createdAt: t.Date(),
    updatedAt: t.Date(),
    cancelledAt: t.Nullable(t.Date({ description: 'Terisi saat reminder dibatalkan.' }))
  },
  { title: 'Reminder', description: 'Jadwal pengingat milik satu todo.' }
);

export const reminderResponseSchema = t.Object(
  { reminder: reminderSchema },
  { title: 'ReminderResponse', description: 'Detail satu reminder.' }
);

export const listRemindersQuerySchema = t.Object({
  status: t.Optional(
    t.String({
      enum: [...REMINDER_STATUSES, 'all'],
      default: 'scheduled',
      description: 'Filter status: scheduled (default), cancelled, atau all.'
    })
  ),
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
  )
});

export const listRemindersResponseSchema = t.Object(
  {
    items: t.Array(reminderSchema, { description: 'Reminder pada halaman ini.' }),
    pagination: paginationSchema
  },
  {
    title: 'ListRemindersResponse',
    description: 'Daftar reminder dengan urutan effectiveAt ASC dan id sebagai tie-breaker.'
  }
);

export { errorResponseSchema };
