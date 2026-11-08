import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '../api/workspace.api';
import { workspaceKeys } from '../api/workspace.query-keys';
import type { UpdateWorkspaceInput, Workspace } from '../models/workspace.model';

export interface UpdateWorkspaceVariables {
  readonly workspaceId: string;
  readonly input: UpdateWorkspaceInput;
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation<Workspace, Error, UpdateWorkspaceVariables>({
    mutationFn: ({ workspaceId, input }: UpdateWorkspaceVariables) =>
      workspaceApi.update(workspaceId, input),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
      queryClient.setQueryData(workspaceKeys.detail(updated.id), updated);
    }
  });
}
