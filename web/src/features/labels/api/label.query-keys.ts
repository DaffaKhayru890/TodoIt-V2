import type { ListLabelsParams } from '../models/label.model';

export const labelKeys = {
  all: ['labels'] as const,

  lists: () => [...labelKeys.all, 'list'] as const,

  workspaceLists: (workspaceId: string) => [...labelKeys.lists(), workspaceId] as const,

  list: (workspaceId: string, params?: ListLabelsParams) =>
    [...labelKeys.workspaceLists(workspaceId), params ?? {}] as const,

  details: () => [...labelKeys.all, 'detail'] as const,

  detail: (workspaceId: string, labelId: string) =>
    [...labelKeys.details(), workspaceId, labelId] as const
};
