import { useQuery } from '@tanstack/react-query';
import { ApiError } from '@/core/errors/api-error';
import { workspaceApi } from '../api/workspace.api';
import { workspaceKeys } from '../api/workspace.query-keys';

export function useWorkspace(workspaceId: string, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: workspaceKeys.detail(workspaceId),
    queryFn: () => workspaceApi.getById(workspaceId),
    enabled: Boolean(workspaceId) && (options?.enabled ?? true),
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
