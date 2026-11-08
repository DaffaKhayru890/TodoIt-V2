import { z } from 'zod';

/**
 * Field yang sama dipakai Create dan Edit. Batas mengikuti schema backend:
 * title 1-200 karakter setelah trim, description maksimal 5000 karakter.
 */
export const todoFieldsSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Judul tugas wajib diisi')
    .max(200, 'Judul tugas maksimal 200 karakter'),
  description: z
    .string()
    .trim()
    .max(5000, 'Deskripsi maksimal 5000 karakter')
    .optional()
    .or(z.literal(''))
});

export type TodoFormValues = z.infer<typeof todoFieldsSchema>;
