import type { TodoFilterState } from '../models/todo-filter';
import type { TodoSort } from './sort-todos';
import { serializeTodoFilter } from './filter-url';

export const WORKSPACE_SCROLL_KEY_PREFIX = 'todoit.scroll.workspace.v1';

/**
 * Key memisahkan posisi scroll per workspace, filter, dan sorting. Nilai
 * dihitung dari hasil serialisasi URL agar urutan parameter stabil.
 */
export function buildWorkspaceScrollKey(
  workspaceId: string,
  filter: TodoFilterState,
  sort: TodoSort
): string {
  const filterKey = serializeTodoFilter(filter).toString();
  return [WORKSPACE_SCROLL_KEY_PREFIX, workspaceId, sort.field, sort.direction, filterKey].join(
    ':'
  );
}
