import { z } from 'zod';

export const updateWorkspaceSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nama workspace wajib diisi')
    .max(100, 'Nama workspace maksimal 100 karakter'),
  description: z
    .string()
    .trim()
    .max(500, 'Deskripsi maksimal 500 karakter')
    .optional()
    .or(z.literal(''))
});

export type UpdateWorkspaceFormValues = z.infer<typeof updateWorkspaceSchema>;
