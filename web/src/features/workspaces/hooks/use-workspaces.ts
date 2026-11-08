import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/core/errors/api-error';
import { workspaceApi, type ListWorkspacesParams } from '../api/workspace.api';
import { workspaceKeys } from '../api/workspace.query-keys';

export function useWorkspaces(params?: ListWorkspacesParams) {
  return useQuery({
    queryKey: workspaceKeys.list(params),
    queryFn: () => workspaceApi.getAll(params),
    retry: (failureCount, error) => {
      if (
        error instanceof ApiError &&
        (error.status === 401 || error.status === 403 || error.status === 404)
      ) {
        return false;
      }
      return failureCount < 1;
    }
  });
}
