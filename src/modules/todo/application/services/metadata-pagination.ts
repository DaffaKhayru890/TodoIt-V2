import { TodoError } from '../../domain/errors/todo-error';

export const DEFAULT_METADATA_LIST_LIMIT = 20;
export const MAX_METADATA_LIST_LIMIT = 100;

export function normalizeMetadataLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_METADATA_LIST_LIMIT;
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_METADATA_LIST_LIMIT) {
    throw TodoError.validationError(
      `Limit harus bilangan bulat antara 1 dan ${MAX_METADATA_LIST_LIMIT}.`
    );
  }

  return limit;
}

export function normalizeMetadataSearch(
  q: string | undefined,
  maxLength = 50
): string | undefined {
  if (q === undefined) {
    return undefined;
  }

  const search = q.trim();

  if (search.length === 0) {
    return undefined;
  }

  if (search.length > maxLength) {
    throw TodoError.validationError(`Kata kunci pencarian maksimal ${maxLength} karakter.`);
  }

  return search;
}
