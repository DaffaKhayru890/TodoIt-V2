import type { ApiErrorDetail } from '@/core/api/api-response';

/**
 * Memetakan detail `VALIDATION_ERROR` backend (mis. `body.name`) ke nama field
 * form. Backend tetap menjadi sumber validasi utama; pemetaan ini hanya
 * memindahkan pesan ke field yang tepat agar UX lebih jelas.
 */
export function mapValidationDetails<Field extends string>(
  details: readonly ApiErrorDetail[],
  fields: readonly Field[]
): Partial<Record<Field, string>> {
  const mapped: Partial<Record<Field, string>> = {};

  for (const detail of details) {
    if (detail.path.length === 0 || detail.message.length === 0) {
      continue;
    }

    const field = fields.find(
      (candidate) =>
        detail.path === candidate ||
        detail.path.endsWith(`.${candidate}`) ||
        detail.path.endsWith(`[${candidate}]`)
    );

    if (field && mapped[field] === undefined) {
      mapped[field] = detail.message;
    }
  }

  return mapped;
}
