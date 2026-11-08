/**
 * Query key factory Todo.
 *
 * Semua list dan detail membawa workspaceId. Ini mencegah cache Workspace A
 * dipakai atau diinvalidasi oleh mutation Workspace B.
 */
export const todoKeys = {
  all: ['todos'] as const,

  lists: () => [...todoKeys.all, 'list'] as const,

  workspaceLists: (workspaceId: string) => [...todoKeys.lists(), 'workspace', workspaceId] as const,

  workspace: (
    workspaceId: string,
    params?: { readonly limit?: number; readonly cursor?: string }
  ) => [...todoKeys.workspaceLists(workspaceId), params ?? {}] as const,

  details: () => [...todoKeys.all, 'detail'] as const,

  detail: (workspaceId: string, todoId: string) =>
    [...todoKeys.details(), workspaceId, todoId] as const
};
