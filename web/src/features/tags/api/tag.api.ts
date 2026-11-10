import { httpClient, type HttpClient } from '@/core/api/http-client';
import {
  assertTagListResponseDto,
  assertTagResponseDto,
  assertTodoTagsResponseDto
} from '../models/tag.guard';
import {
  toCreateTagRequestDto,
  toTag,
  toTagListResult,
  toTodoTagSummaries,
  toUpdateTagRequestDto
} from '../models/tag.mapper';
import type {
  CreateTagInput,
  ListTagsParams,
  Tag,
  TagListResult,
  TodoTagSummary,
  UpdateTagInput
} from '../models/tag.model';

export const TAG_LIST_PAGE_SIZE = 100;

export interface TagApiService {
  getAll(workspaceId: string, params?: ListTagsParams): Promise<TagListResult>;
  getById(workspaceId: string, tagId: string): Promise<Tag>;
  create(workspaceId: string, input: CreateTagInput): Promise<Tag>;
  update(workspaceId: string, tagId: string, input: UpdateTagInput): Promise<Tag>;
  remove(workspaceId: string, tagId: string): Promise<void>;
  replaceTodoTags(
    workspaceId: string,
    todoId: string,
    tagIds: readonly string[]
  ): Promise<readonly TodoTagSummary[]>;
  addTodoTag(
    workspaceId: string,
    todoId: string,
    tagId: string
  ): Promise<readonly TodoTagSummary[]>;
  removeTodoTag(
    workspaceId: string,
    todoId: string,
    tagId: string
  ): Promise<readonly TodoTagSummary[]>;
}

function tagsPath(workspaceId: string): string {
  return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/tags`;
}

function todoTagsPath(workspaceId: string, todoId: string): string {
  return `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/todos/${encodeURIComponent(todoId)}/tags`;
}

function buildListPath(workspaceId: string, params?: ListTagsParams): string {
  const searchParams = new URLSearchParams();

  if (params?.limit !== undefined) searchParams.set('limit', String(params.limit));
  if (params?.cursor !== undefined) searchParams.set('cursor', params.cursor);
  if (params?.q !== undefined && params.q.length > 0) searchParams.set('q', params.q);

  const query = searchParams.toString();
  return query ? `${tagsPath(workspaceId)}?${query}` : tagsPath(workspaceId);
}

export function createTagApi(client: HttpClient = httpClient): TagApiService {
  async function requestTodoTags(path: string, method: 'PUT' | 'POST' | 'DELETE', body?: unknown) {
    const response = await client.request<unknown>(path, {
      method,
      ...(body !== undefined ? { body } : {})
    });

    assertTodoTagsResponseDto(response);
    return toTodoTagSummaries(response);
  }

  return {
    async getAll(workspaceId, params) {
      const response = await client.request<unknown>(buildListPath(workspaceId, params), {
        method: 'GET'
      });

      assertTagListResponseDto(response);
      return toTagListResult(response);
    },

    async getById(workspaceId, tagId) {
      const response = await client.request<unknown>(`${tagsPath(workspaceId)}/${tagId}`, {
        method: 'GET'
      });

      assertTagResponseDto(response);
      return toTag(response.tag);
    },

    async create(workspaceId, input) {
      const response = await client.request<unknown>(tagsPath(workspaceId), {
        method: 'POST',
        body: toCreateTagRequestDto(input)
      });

      assertTagResponseDto(response);
      return toTag(response.tag);
    },

    async update(workspaceId, tagId, input) {
      const response = await client.request<unknown>(`${tagsPath(workspaceId)}/${tagId}`, {
        method: 'PATCH',
        body: toUpdateTagRequestDto(input)
      });

      assertTagResponseDto(response);
      return toTag(response.tag);
    },

    async remove(workspaceId, tagId) {
      await client.request<void>(`${tagsPath(workspaceId)}/${tagId}`, {
        method: 'DELETE'
      });
    },

    async replaceTodoTags(workspaceId, todoId, tagIds) {
      return requestTodoTags(todoTagsPath(workspaceId, todoId), 'PUT', { tagIds });
    },

    async addTodoTag(workspaceId, todoId, tagId) {
      return requestTodoTags(`${todoTagsPath(workspaceId, todoId)}/${tagId}`, 'POST');
    },

    async removeTodoTag(workspaceId, todoId, tagId) {
      return requestTodoTags(`${todoTagsPath(workspaceId, todoId)}/${tagId}`, 'DELETE');
    }
  };
}

export const tagApi = createTagApi();
