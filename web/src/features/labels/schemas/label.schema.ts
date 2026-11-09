import { z } from 'zod';

export const LABEL_COLOR_PRESETS = [
  '#3498DB',
  '#9B59B6',
  '#E74C3C',
  '#F39C12',
  '#27AE60',
  '#16A085',
  '#34495E',
  '#E84393'
] as const;

/** Backend menerima tepat #RRGGBB dan menyimpannya uppercase. */
export const labelColorSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Warna harus format #RRGGBB');

export const labelFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama label wajib diisi')
    .max(50, 'Nama label maksimal 50 karakter'),
  color: labelColorSchema,
  description: z
    .string()
    .trim()
    .max(300, 'Deskripsi maksimal 300 karakter')
    .optional()
    .or(z.literal(''))
});

export type LabelFormValues = z.infer<typeof labelFormSchema>;
