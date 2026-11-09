import { useQuery } from '@tanstack/react-query';
import { labelApi, LABEL_LIST_PAGE_SIZE } from '../api/label.api';
import { labelKeys } from '../api/label.query-keys';
import type { ListLabelsParams } from '../models/label.model';

export function useLabels(workspaceId: string, params?: ListLabelsParams) {
  const effectiveParams: ListLabelsParams = {
    ...params,
    limit: params?.limit ?? LABEL_LIST_PAGE_SIZE
  };

  return useQuery({
    queryKey: labelKeys.list(workspaceId, effectiveParams),
    queryFn: () => labelApi.getAll(workspaceId, effectiveParams),
    enabled: Boolean(workspaceId),
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 1;
    }
  });
}
