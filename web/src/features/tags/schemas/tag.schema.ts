import { z } from 'zod';

/** Batas backend: nama 1-50 karakter setelah trim, unik case-insensitive. */
export const tagFormSchema = z.object({
  name: z.string().trim().min(1, 'Nama tag wajib diisi').max(50, 'Nama tag maksimal 50 karakter')
});

export type TagFormValues = z.infer<typeof tagFormSchema>;
