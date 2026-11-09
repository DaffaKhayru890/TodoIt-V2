import type { ListTagsParams } from '../models/tag.model';

export const tagKeys = {
  all: ['tags'] as const,

  lists: () => [...tagKeys.all, 'list'] as const,

  workspaceLists: (workspaceId: string) => [...tagKeys.lists(), workspaceId] as const,

  list: (workspaceId: string, params?: ListTagsParams) =>
    [...tagKeys.workspaceLists(workspaceId), params ?? {}] as const,

  details: () => [...tagKeys.all, 'detail'] as const,

  detail: (workspaceId: string, tagId: string) =>
    [...tagKeys.details(), workspaceId, tagId] as const
};
