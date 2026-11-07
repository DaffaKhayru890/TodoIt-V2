import { WorkspaceError } from '../../domain/errors/workspace-error';

export const DEFAULT_COLLABORATION_LIMIT = 20;
export const MAX_COLLABORATION_LIMIT = 100;

export function normalizeCollaborationLimit(limit: number | undefined): number {
  if (limit === undefined) {
    return DEFAULT_COLLABORATION_LIMIT;
  }

  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_COLLABORATION_LIMIT) {
    throw WorkspaceError.validationError(
      `Limit harus bilangan bulat antara 1 dan ${MAX_COLLABORATION_LIMIT}.`
    );
  }

  return limit;
}
