import { useMutation, useQueryClient } from '@tanstack/react-query';
import { workspaceApi } from '../api/workspace.api';
import { workspaceKeys } from '../api/workspace.query-keys';
import type { CreateWorkspaceInput, Workspace } from '../models/workspace.model';

export function useCreateWorkspace() {
  const queryClient = useQueryClient();

  return useMutation<Workspace, Error, CreateWorkspaceInput>({
    mutationFn: (input: CreateWorkspaceInput) => workspaceApi.create(input),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: workspaceKeys.lists() });
      queryClient.setQueryData(workspaceKeys.detail(created.id), created);
    }
  });
}
