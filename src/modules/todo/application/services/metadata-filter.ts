import { TodoError } from '../../domain/errors/todo-error';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_TAG_FILTER_IDS = 100;

/**
 * Normalisasi filter tagIds: trim, buang nilai kosong, hilangkan duplikat, dan
 * pertahankan urutan kemunculan pertama. Nilai kosong berarti tanpa filter.
 */
export function normalizeTagFilter(
  tagIds: readonly string[] | string | undefined
): readonly string[] | undefined {
  if (tagIds === undefined) {
    return undefined;
  }

  const raw = typeof tagIds === 'string' ? [tagIds] : tagIds;
  const normalized: string[] = [];

  for (const candidate of raw) {
    const value = candidate.trim();

    if (value.length === 0) {
      continue;
    }

    if (!UUID_PATTERN.test(value)) {
      throw TodoError.validationError('tagIds harus berisi UUID yang valid.');
    }

    if (!normalized.includes(value)) {
      normalized.push(value);
    }
  }

  if (normalized.length === 0) {
    return undefined;
  }

  if (normalized.length > MAX_TAG_FILTER_IDS) {
    throw TodoError.validationError(
      `tagIds maksimal berisi ${MAX_TAG_FILTER_IDS} nilai.`
    );
  }

  return normalized;
}

export function normalizeLabelFilter(
  labelId: string | null | undefined
): string | undefined {
  if (labelId === undefined || labelId === null) {
    return undefined;
  }

  const value = labelId.trim();

  if (value.length === 0) {
    return undefined;
  }

  if (!UUID_PATTERN.test(value)) {
    throw TodoError.validationError('labelId harus berupa UUID yang valid.');
  }

  return value;
}
