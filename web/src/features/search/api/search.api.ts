import { httpClient, type HttpClient } from '@/core/api/http-client';
import { assertLabelListResponseDto } from '@/features/labels/models/label.guard';
import { toLabelListResult } from '@/features/labels/models/label.mapper';
import { assertTagListResponseDto } from '@/features/tags/models/tag.guard';
import { toTagListResult } from '@/features/tags/models/tag.mapper';
import { assertTodoListResponseDto } from '@/features/todos/models/todo.guard';
import { toTodoListResult } from '@/features/todos/models/todo.mapper';
import { getTodoStatusLabel, type Todo } from '@/features/todos/models/todo.model';
import { getPriorityLabel } from '@/features/todos/models/todo-priority';
import { paths } from '@/app/router/route-paths';
import type {
  GlobalSearchResult,
  SearchRequest,
  SearchResultGroup,
  SearchResultItem,
  SearchWorkspace
} from '../models/search.model';

/** Jumlah maksimum item per kategori per workspace pada fan-out pencarian. */
export const SEARCH_TODO_LIMIT_PER_WORKSPACE = 8;
export const SEARCH_TAG_LIMIT_PER_WORKSPACE = 5;
export const SEARCH_LABEL_LIMIT_PER_WORKSPACE = 5;

const DESCRIPTION_PREVIEW_LENGTH = 140;

interface WorkspaceSearchOutcome {
  readonly workspace: SearchWorkspace;
  readonly todos: readonly SearchResultItem[];
  readonly tags: readonly SearchResultItem[];
  readonly labels: readonly SearchResultItem[];
}

export interface SearchApiService {
  search(request: SearchRequest): Promise<GlobalSearchResult>;
  searchWorkspace(
    workspace: SearchWorkspace,
    query: string,
    signal?: AbortSignal
  ): Promise<WorkspaceSearchOutcome>;
}

function withQuery(path: string, params: URLSearchParams): string {
  const query = params.toString();
  return query ? `${path}?${query}` : path;
}

function buildPath(
  workspaceId: string,
  resource: 'todos' | 'tags' | 'labels',
  query: string,
  limit: number
): string {
  const params = new URLSearchParams();
  params.set('limit', String(limit));
  params.set('q', query);

  return withQuery(`/api/v1/workspaces/${encodeURIComponent(workspaceId)}/${resource}`, params);
}

function preview(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value.replace(/\s+/g, ' ').trim();

  if (normalized.length <= DESCRIPTION_PREVIEW_LENGTH) {
    return normalized;
  }

  return `${normalized.slice(0, DESCRIPTION_PREVIEW_LENGTH - 1).trimEnd()}…`;
}

function toTodoItem(todo: Todo, workspace: SearchWorkspace): SearchResultItem {
  return {
    id: todo.id,
    kind: 'todo',
    title: todo.title,
    description: preview(todo.description),
    meta: `${getTodoStatusLabel(todo.status)} · Prioritas ${getPriorityLabel(todo.priority)}`,
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    href: paths.todo(workspace.id, todo.id)
  };
}

function toTagItem(
  tag: { id: string; name: string },
  workspace: SearchWorkspace
): SearchResultItem {
  return {
    id: tag.id,
    kind: 'tag',
    title: tag.name,
    description: null,
    meta: 'Tag',
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    href: paths.tags(workspace.id)
  };
}

function toLabelItem(
  label: { id: string; name: string; description: string | null },
  workspace: SearchWorkspace
): SearchResultItem {
  return {
    id: label.id,
    kind: 'label',
    title: label.name,
    description: preview(label.description),
    meta: 'Label',
    workspaceId: workspace.id,
    workspaceName: workspace.name,
    href: paths.labels(workspace.id)
  };
}

async function requestWorkspace(
  client: HttpClient,
  workspace: SearchWorkspace,
  query: string,
  signal: AbortSignal | undefined
): Promise<WorkspaceSearchOutcome> {
  const requestOptions = signal ? { method: 'GET' as const, signal } : { method: 'GET' as const };

  const [todoResponse, tagResponse, labelResponse] = await Promise.all([
    client.request<unknown>(
      buildPath(workspace.id, 'todos', query, SEARCH_TODO_LIMIT_PER_WORKSPACE),
      requestOptions
    ),
    client.request<unknown>(
      buildPath(workspace.id, 'tags', query, SEARCH_TAG_LIMIT_PER_WORKSPACE),
      requestOptions
    ),
    client.request<unknown>(
      buildPath(workspace.id, 'labels', query, SEARCH_LABEL_LIMIT_PER_WORKSPACE),
      requestOptions
    )
  ]);

  assertTodoListResponseDto(todoResponse);
  assertTagListResponseDto(tagResponse);
  assertLabelListResponseDto(labelResponse);

  const todos = toTodoListResult(todoResponse).items.map((todo) => toTodoItem(todo, workspace));
  const tags = toTagListResult(tagResponse).items.map((tag) => toTagItem(tag, workspace));
  const labels = toLabelListResult(labelResponse).items.map((label) =>
    toLabelItem(
      {
        id: label.id,
        name: label.name,
        description: label.description
      },
      workspace
    )
  );

  return { workspace, todos, tags, labels };
}

function buildGroups(items: readonly WorkspaceSearchOutcome[]): readonly SearchResultGroup[] {
  const todos = items.flatMap((item) => item.todos);
  const tags = items.flatMap((item) => item.tags);
  const labels = items.flatMap((item) => item.labels);

  const groups: readonly SearchResultGroup[] = [
    { kind: 'todo', label: 'Tugas', items: todos },
    { kind: 'tag', label: 'Tag', items: tags },
    { kind: 'label', label: 'Label', items: labels }
  ];

  return groups.filter((group) => group.items.length > 0);
}

function dedupeById(items: readonly SearchResultItem[]): readonly SearchResultItem[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    if (seen.has(item.id)) {
      return false;
    }

    seen.add(item.id);
    return true;
  });
}

export function createSearchApi(client: HttpClient = httpClient): SearchApiService {
  return {
    async searchWorkspace(workspace, query, signal) {
      return requestWorkspace(client, workspace, query, signal);
    },

    async search(request) {
      if (request.workspaces.length === 0) {
        return { query: request.query, groups: [], total: 0, failedWorkspaces: 0 };
      }

      if (request.signal?.aborted) {
        throw new DOMException('Pencarian dibatalkan.', 'AbortError');
      }

      const settled = await Promise.allSettled(
        request.workspaces.map((workspace) =>
          requestWorkspace(client, workspace, request.query, request.signal)
        )
      );

      if (request.signal?.aborted) {
        throw new DOMException('Pencarian dibatalkan.', 'AbortError');
      }

      const fulfilled = settled.filter(
        (result): result is PromiseFulfilledResult<WorkspaceSearchOutcome> =>
          result.status === 'fulfilled'
      );
      const failures = settled.filter((result) => result.status === 'rejected');

      if (fulfilled.length === 0) {
        const firstFailure = failures[0];

        if (firstFailure && firstFailure.status === 'rejected') {
          throw firstFailure.reason;
        }

        return { query: request.query, groups: [], total: 0, failedWorkspaces: 0 };
      }

      const groups = buildGroups(fulfilled.map((result) => result.value)).map((group) => ({
        ...group,
        items: dedupeById(group.items)
      }));
      const total = groups.reduce((sum, group) => sum + group.items.length, 0);

      return {
        query: request.query,
        groups,
        total,
        failedWorkspaces: failures.length
      };
    }
  };
}

export const searchApi = createSearchApi();
