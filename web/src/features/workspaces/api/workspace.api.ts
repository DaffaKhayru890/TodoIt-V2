import { httpClient, type HttpClient } from '@/core/api/http-client';
import type {
  ArchiveWorkspaceResponseDto,
  CreateWorkspaceResponseDto,
  ListWorkspacesResponseDto,
  UpdateWorkspaceResponseDto,
  WorkspaceDetailResponseDto
} from '../models/workspace.dto';
import {
  toArchiveWorkspaceResult,
  toCreateWorkspaceRequestDto,
  toUpdateWorkspaceRequestDto,
  toWorkspace,
  toWorkspaceListResult
} from '../models/workspace.mapper';
import type {
  ArchiveWorkspaceResult,
  CreateWorkspaceInput,
  UpdateWorkspaceInput,
  Workspace,
  WorkspaceListResult
} from '../models/workspace.model';

export interface ListWorkspacesParams {
  readonly limit?: number;
  readonly offset?: number;
}

export interface WorkspaceApiService {
  getAll(params?: ListWorkspacesParams): Promise<WorkspaceListResult>;
  getById(workspaceId: string): Promise<Workspace>;
  create(input: CreateWorkspaceInput): Promise<Workspace>;
  update(workspaceId: string, input: UpdateWorkspaceInput): Promise<Workspace>;
  archive(workspaceId: string): Promise<ArchiveWorkspaceResult>;
}

export function createWorkspaceApi(client: HttpClient = httpClient): WorkspaceApiService {
  return {
    async getAll(params?: ListWorkspacesParams): Promise<WorkspaceListResult> {
      const searchParams = new URLSearchParams();
      if (params?.limit !== undefined) {
        searchParams.set('limit', String(params.limit));
      }
      if (params?.offset !== undefined) {
        searchParams.set('offset', String(params.offset));
      }

      const queryString = searchParams.toString();
      const path = queryString ? `/api/v1/workspaces?${queryString}` : '/api/v1/workspaces';

      const response = await client.request<ListWorkspacesResponseDto>(path, {
        method: 'GET'
      });

      return toWorkspaceListResult(response);
    },

    async getById(workspaceId: string): Promise<Workspace> {
      const response = await client.request<WorkspaceDetailResponseDto>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`,
        {
          method: 'GET'
        }
      );

      return toWorkspace(response.workspace);
    },

    async create(input: CreateWorkspaceInput): Promise<Workspace> {
      const payload = toCreateWorkspaceRequestDto(input);
      const response = await client.request<CreateWorkspaceResponseDto>('/api/v1/workspaces', {
        method: 'POST',
        body: payload
      });

      return toWorkspace(response.workspace);
    },

    async update(workspaceId: string, input: UpdateWorkspaceInput): Promise<Workspace> {
      const payload = toUpdateWorkspaceRequestDto(input);
      const response = await client.request<UpdateWorkspaceResponseDto>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`,
        {
          method: 'PATCH',
          body: payload
        }
      );

      return toWorkspace(response.workspace);
    },

    async archive(workspaceId: string): Promise<ArchiveWorkspaceResult> {
      const response = await client.request<ArchiveWorkspaceResponseDto>(
        `/api/v1/workspaces/${encodeURIComponent(workspaceId)}/archive`,
        {
          method: 'POST'
        }
      );

      return toArchiveWorkspaceResult(response);
    }
  };
}

export const workspaceApi = createWorkspaceApi();
