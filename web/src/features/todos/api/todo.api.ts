import { httpClient, type HttpClient } from '@/core/api/http-client';
import { assertTodoListResponseDto, assertTodoResponseDto } from '../models/todo.guard';
import {
  toCreateTodoRequestDto,
  toTodo,
  toTodoListResult,
  toUpdateTodoRequestDto
} from '../models/todo.mapper';
import type { CreateTodoInput, Todo, TodoListResult, UpdateTodoInput } from '../models/todo.model';

/** Batas maksimum backend. Phase 4 mengambil satu halaman pertama. */
export const TODO_LIST_PAGE_SIZE = 100;

export interface ListTodosParams {
  readonly limit?: number;
  readonly cursor?: string;
}

export interface TodoApiService {
  getByWorkspace(workspaceId: string, params?: ListTodosParams): Promise<TodoListResult>;
  getById(workspaceId: string, todoId: string): Promise<Todo>;
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

function buildListPath(workspaceId: string, params?: ListTodosParams): string {
  const searchParams = new URLSearchParams();

  if (params?.limit !== undefined) {
    searchParams.set('limit', String(params.limit));
  }

  if (params?.cursor !== undefined) {
    searchParams.set('cursor', params.cursor);
  }

  const queryString = searchParams.toString();

  return queryString
    ? `${workspaceTodosPath(workspaceId)}?${queryString}`
    : workspaceTodosPath(workspaceId);
}

export function createTodoApi(client: HttpClient = httpClient): TodoApiService {
  return {
    async getByWorkspace(workspaceId: string, params?: ListTodosParams): Promise<TodoListResult> {
      const response = await client.request<unknown>(buildListPath(workspaceId, params), {
        method: 'GET'
      });

      assertTodoListResponseDto(response);

      return toTodoListResult(response);
    },

    async getById(workspaceId: string, todoId: string): Promise<Todo> {
      const response = await client.request<unknown>(todoPath(workspaceId, todoId), {
        method: 'GET'
      });

      assertTodoResponseDto(response);

      return toTodo(response.todo);
    },

    async create(workspaceId: string, input: CreateTodoInput): Promise<Todo> {
      const response = await client.request<unknown>(workspaceTodosPath(workspaceId), {
        method: 'POST',
        body: toCreateTodoRequestDto(input)
      });

      assertTodoResponseDto(response);

      return toTodo(response.todo);
    },

    async update(workspaceId: string, todoId: string, input: UpdateTodoInput): Promise<Todo> {
      const response = await client.request<unknown>(todoPath(workspaceId, todoId), {
        method: 'PATCH',
        body: toUpdateTodoRequestDto(input)
      });

      assertTodoResponseDto(response);

      return toTodo(response.todo);
    },

    async complete(workspaceId: string, todoId: string): Promise<Todo> {
      const response = await client.request<unknown>(`${todoPath(workspaceId, todoId)}/complete`, {
        method: 'PATCH'
      });

      assertTodoResponseDto(response);

      return toTodo(response.todo);
    },

    async remove(workspaceId: string, todoId: string): Promise<void> {
      await client.request<void>(todoPath(workspaceId, todoId), {
        method: 'DELETE'
      });
    }
  };
}

export const todoApi = createTodoApi();
