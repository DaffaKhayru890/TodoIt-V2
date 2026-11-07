import { TodoError } from '../../domain/errors/todo-error';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MAX_TAGS_PER_TODO = 20;

/**
 * Menormalkan daftar tagId untuk assignment: trim, deduplikasi, validasi UUID,
 * dan penegakan batas maksimal 20 tag per Todo.
 */
export function normalizeAssignmentTagIds(raw: readonly string[]): string[] {
  if (!Array.isArray(raw)) {
    throw TodoError.tagAssignmentInvalid('tagIds harus berupa array.');
  }

  const normalized: string[] = [];

  for (const candidate of raw) {
    if (typeof candidate !== 'string') {
      throw TodoError.tagAssignmentInvalid('tagIds harus berisi string UUID.');
    }

    const value = candidate.trim();

    if (value.length === 0) {
      continue;
    }

    if (!UUID_PATTERN.test(value)) {
      throw TodoError.tagAssignmentInvalid('tagIds harus berisi UUID yang valid.');
    }

    if (!normalized.includes(value)) {
      normalized.push(value);
    }
  }

  if (normalized.length > MAX_TAGS_PER_TODO) {
    throw TodoError.tagLimitExceeded(MAX_TAGS_PER_TODO);
  }

  return normalized;
}
