import { httpClient, type HttpClient } from '@/core/api/http-client';
import { assertTodoResponseDto } from '@/features/todos/models/todo.guard';
import { toTodo } from '@/features/todos/models/todo.mapper';
import type { Todo } from '@/features/todos/models/todo.model';
import { assertLabelListResponseDto, assertLabelResponseDto } from '../models/label.guard';
import {
  toCreateLabelRequestDto,
  toLabel,
  toLabelListResult,
  toUpdateLabelRequestDto
} from '../models/label.mapper';
import type {
  CreateLabelInput,
  Label,
  LabelListResult,
  ListLabelsParams,
  UpdateLabelInput
} from '../models/label.model';

export const LABEL_LIST_PAGE_SIZE = 100;

export interface LabelApiService {
  getAll(workspaceId: string, params?: ListLabelsParams): Promise<LabelListResult>;
  getById(workspaceId: string, labelId: string): Promise<Label>;
  create(workspaceId: string, input: CreateLabelInput): Promise<Label>;
  update(workspaceId: string, labelId: string, input: UpdateLabelInput): Promise<Label>;
  remove(workspaceId: string, labelId: string): Promise<void>;
  assignTodoLabel(workspaceId: string, todoId: string, labelId: string): Promise<Todo>;
  clearTodoLabel(workspaceId: string, todoId: string): Promise<Todo>;
}

function labelsPath(workspaceId: string): string {
  return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/labels`;
}

function todoLabelPath(workspaceId: string, todoId: string): string {
  return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/todos/${encodeURIComponent(todoId)}/label`;
}

function buildListPath(workspaceId: string, params?: ListLabelsParams): string {
  const searchParams = new URLSearchParams();

  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params?.cursor !== undefined) searchParams.set('cursor', params.cursor);
  if (params?.q !== undefined && params.q.length > 0) searchParams.set('q', params.q);

  const query = searchParams.toString();
  return query ? `${labelsPath(workspaceId)}?${query}` : labelsPath(workspaceId);
}

export function createLabelApi(client: HttpClient = httpClient): LabelApiService {
  return {
    async getAll(workspaceId, params) {
      const response = await client.request<unknown>(buildListPath(workspaceId, params), {
        method: 'GET'
      });

      assertLabelListResponseDto(response);
      return toLabelListResult(response);
    },

    async getById(workspaceId, labelId) {
      const response = await client.request<unknown>(`${labelsPath(workspaceId)}/${labelId}`, {
        method: 'GET'
      });

      assertLabelResponseDto(response);
      return toLabel(response.label);
    },

    async create(workspaceId, input) {
      const response = await client.request<unknown>(labelsPath(workspaceId), {
        method: 'POST',
        body: toCreateLabelRequestDto(input)
      });

      assertLabelResponseDto(response);
      return toLabel(response.label);
    },

    async update(workspaceId, labelId, input) {
      const response = await client.request<unknown>(`${labelsPath(workspaceId)}/${labelId}`, {
        method: 'PATCH',
        body: toUpdateLabelRequestDto(input)
      });

      assertLabelResponseDto(response);
      return toLabel(response.label);
    },

    async remove(workspaceId, labelId) {
      await client.request<void>(`${labelsPath(workspaceId)}/${labelId}`, {
        method: 'DELETE'
      });
    },

    async assignTodoLabel(workspaceId, todoId, labelId) {
      const response = await client.request<unknown>(todoLabelPath(workspaceId, todoId), {
        method: 'PUT',
        body: { labelId }
      });

      assertTodoResponseDto(response);
      return toTodo(response.todo);
    },

    async clearTodoLabel(workspaceId, todoId) {
      const response = await client.request<unknown>(todoLabelPath(workspaceId, todoId), {
        method: 'DELETE'
      });

      assertTodoResponseDto(response);
      return toTodo(response.todo);
    }
  };
}

export const labelApi = createLabelApi();
