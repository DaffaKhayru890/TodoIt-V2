import { z } from 'zod';
import { parseDateTimeInputValue } from '../utils/date-format';
import { todoFieldsSchema } from './todo-fields.schema';

const DATETIME_LOCAL_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

export const todoMetadataSchema = z.object({
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  /** Nilai input `datetime-local` lokal; string kosong berarti tanpa tenggat. */
  dueAt: z.string(),
  tagIds: z.array(z.string()),
  labelId: z.string().nullable(),
  /** Offset menit sebelum tenggat; null berarti pengingat nonaktif. */
  reminderOffset: z.number().int().min(1).max(43_200).nullable()
});

export const createTodoSchema = todoFieldsSchema
  .extend(todoMetadataSchema.shape)
  .superRefine((values, ctx) => {
    if (values.dueAt.length > 0) {
      const parsed = DATETIME_LOCAL_PATTERN.test(values.dueAt)
        ? parseDateTimeInputValue(values.dueAt)
        : null;

      if (!parsed) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['dueAt'],
          message: 'Format tenggat waktu tidak valid.'
        });
      }
    }

    if (values.reminderOffset !== null && values.dueAt.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['reminderOffset'],
        message: 'Pengingat memerlukan tenggat waktu.'
      });
    }
  });

export const updateTodoSchema = createTodoSchema;

export type CreateTodoFormValues = z.infer<typeof createTodoSchema>;
export type UpdateTodoFormValues = z.infer<typeof updateTodoSchema>;
export type { TodoFormValues } from './todo-fields.schema';
