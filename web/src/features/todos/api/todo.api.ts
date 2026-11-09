import { httpClient, type HttpClient } from '@/core/api/http-client';
import { assertTodoListResponseDto, assertTodoResponseDto } from '../models/todo.guard';
import {
  toCreateTodoRequestDto,
  toIsoInstant,
  toTodo,
  toTodoListResult,
  toUpdateTodoRequestDto
} from '../models/todo.mapper';
import type {
  CreateTodoInput,
  OverdueTodosParams,
  Todo,
  TodoListParams,
  TodoListResult,
  TodayTodosParams,
  UpcomingTodosParams,
  UpdateTodoInput
} from '../models/todo.model';

/** Batas maksimum backend. Phase 5 masih mengambil satu halaman pertama. */
export const TODO_LIST_PAGE_SIZE = 100;

export type ListTodosParams = TodoListParams;

export interface TodoApiService {
  getByWorkspace(workspaceId: string, params?: TodoListParams): Promise<TodoListResult>;
  getById(workspaceId: string, todoId: string): Promise<Todo>;
  getToday(workspaceId: string, params?: TodayTodosParams): Promise<TodoListResult>;
  getUpcoming(workspaceId: string, params?: UpcomingTodosParams): Promise<TodoListResult>;
  getOverdue(workspaceId: string, params?: OverdueTodosParams): Promise<TodoListResult>;
  create(workspaceId: string, input: CreateTodoInput): Promise<Todo>;
  update(workspaceId: string, todoId: string, input: UpdateTodoInput): Promise<Todo>;
  complete(workspaceId: string, todoId: string): Promise<Todo>;
  remove(workspaceId: string, todoId: string): Promise<void>;
}

function workspaceTodosPath(workspaceId: string): string {
  return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/todos`;
}

function todoPath(workspaceId: string, todoId: string): string {
  return `${workspaceTodosPath(workspaceId)}/${encodeURIComponent(todoId)}`;
}

function appendValue(
  searchParams: URLSearchParams,
  key: string,
  value: string | number | boolean | null | undefined
): void {
  if (value === undefined || value === null) {
    return;
  }

  searchParams.set(key, String(value));
}

function appendTagIds(searchParams: URLSearchParams, tagIds: readonly string[] | undefined): void {
  for (const tagId of tagIds ?? []) {
    searchParams.append('tagIds', tagId);
  }
}

function withQuery(path: string, searchParams: URLSearchParams): string {
  const queryString = searchParams.toString();
  return queryString ? `${path}?${queryString}` : path;
}

function isoOrUndefined(value: Date | undefined): string | undefined {
  return value === undefined ? undefined : toIsoInstant(value);
}

function buildListPath(workspaceId: string, params?: TodoListParams): string {
  const searchParams = new URLSearchParams();

  appendValue(searchParams, 'limit', params?.limit);
  appendValue(searchParams, 'cursor', params?.cursor);
  appendValue(searchParams, 'status', params?.status);
  appendValue(searchParams, 'priority', params?.priority);
  appendValue(searchParams, 'dueFrom', isoOrUndefined(params?.dueFrom));
  appendValue(searchParams, 'dueTo', isoOrUndefined(params?.dueTo));
  appendValue(searchParams, 'createdFrom', isoOrUndefined(params?.createdFrom));
  appendValue(searchParams, 'createdTo', isoOrUndefined(params?.createdTo));
  appendValue(searchParams, 'q', params?.q);
  appendTagIds(searchParams, params?.tagIds);
  appendValue(searchParams, 'labelId', params?.labelId);

  return withQuery(workspaceTodosPath(workspaceId), searchParams);
}

function buildTodayPath(workspaceId: string, params?: TodayTodosParams): string {
  const searchParams = new URLSearchParams();

  appendValue(searchParams, 'timezone', params?.timezone);
  appendValue(searchParams, 'includeCompleted', params?.includeCompleted);
  appendValue(searchParams, 'limit', params?.limit);
  appendValue(searchParams, 'cursor', params?.cursor);
  appendTagIds(searchParams, params?.tagIds);
  appendValue(searchParams, 'labelId', params?.labelId);

  return withQuery(`${workspaceTodosPath(workspaceId)}/today`, searchParams);
}

function buildUpcomingPath(workspaceId: string, params?: UpcomingTodosParams): string {
  const searchParams = new URLSearchParams();

  appendValue(searchParams, 'timezone', params?.timezone);
  appendValue(searchParams, 'days', params?.days);
  appendValue(searchParams, 'limit', params?.limit);
  appendValue(searchParams, 'cursor', params?.cursor);
  appendTagIds(searchParams, params?.tagIds);
  appendValue(searchParams, 'labelId', params?.labelId);

  return withQuery(`${workspaceTodosPath(workspaceId)}/upcoming`, searchParams);
}

function buildOverduePath(workspaceId: string, params?: OverdueTodosParams): string {
  const searchParams = new URLSearchParams();

  appendValue(searchParams, 'timezone', params?.timezone);
  appendValue(searchParams, 'limit', params?.limit);
  appendValue(searchParams, 'cursor', params?.cursor);
  appendTagIds(searchParams, params?.tagIds);
  appendValue(searchParams, 'labelId', params?.labelId);

  return withQuery(`${workspaceTodosPath(workspaceId)}/overdue`, searchParams);
}

async function requestList(client: HttpClient, path: string): Promise<TodoListResult> {
  const response = await client.request<unknown>(path, { method: 'GET' });
  assertTodoListResponseDto(response);
  return toTodoListResult(response);
}

export function createTodoApi(client: HttpClient = httpClient): TodoApiService {
  return {
    async getByWorkspace(workspaceId, params) {
      return requestList(client, buildListPath(workspaceId, params));
    },

    async getById(workspaceId, todoId) {
      const response = await client.request<unknown>(todoPath(workspaceId, todoId), {
        method: 'GET'
      });

      assertTodoResponseDto(response);

      return toTodo(response.todo);
    },

    async getToday(workspaceId, params) {
      return requestList(client, buildTodayPath(workspaceId, params));
    },

    async getUpcoming(workspaceId, params) {
      return requestList(client, buildUpcomingPath(workspaceId, params));
    },

    async getOverdue(workspaceId, params) {
      return requestList(client, buildOverduePath(workspaceId, params));
    },

    async create(workspaceId, input) {
      const response = await client.request<unknown>(workspaceTodosPath(workspaceId), {
        method: 'POST',
        body: toCreateTodoRequestDto(input)
      });

      assertTodoResponseDto(response);

      return toTodo(response.todo);
    },

    async update(workspaceId, todoId, input) {
      const response = await client.request<unknown>(todoPath(workspaceId, todoId), {
        method: 'PATCH',
        body: toUpdateTodoRequestDto(input)
      });

      assertTodoResponseDto(response);

      return toTodo(response.todo);
    },

    async complete(workspaceId, todoId) {
      const response = await client.request<unknown>(`${todoPath(workspaceId, todoId)}/complete`, {
        method: 'PATCH'
      });

      assertTodoResponseDto(response);

      return toTodo(response.todo);
    },

    async remove(workspaceId, todoId) {
      await client.request<void>(todoPath(workspaceId, todoId), {
        method: 'DELETE'
      });
    }
  };
}

export const todoApi = createTodoApi();
