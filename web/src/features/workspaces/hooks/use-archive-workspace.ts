import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '../api/workspace.api';
import { workspaceKeys } from '../api/workspace.query-keys';
import type { ArchiveWorkspaceResult } from '../models/workspace.model';

export function useArchiveWorkspace() {
  const queryClient = useQueryClient();

  return useMutation<ArchiveWorkspaceResult, Error, string>({
    mutationFn: (workspaceId: string) => workspaceApi.archive(workspaceId),
    onSuccess: (_result, workspaceId) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
      queryClient.removeQueries({ queryKey: workspaceKeys.detail(workspaceId) });
    }
  });
}
