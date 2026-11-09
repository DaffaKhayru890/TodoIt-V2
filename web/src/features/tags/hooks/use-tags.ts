import { useQuery } from '@tanstack/react-query';
import { tagApi, TAG_LIST_PAGE_SIZE } from '../api/tag.api';
import { tagKeys } from '../api/tag.query-keys';
import type { ListTagsParams } from '../models/tag.model';

export function useTags(workspaceId: string, params?: ListTagsParams) {
  const effectiveParams: ListTagsParams = {
    ...params,
    limit: params?.limit ?? TAG_LIST_PAGE_SIZE
  };

  return useQuery({
    queryKey: tagKeys.list(workspaceId, effectiveParams),
    queryFn: () => tagApi.getAll(workspaceId, effectiveParams),
    enabled: Boolean(workspaceId),
    retry: (failureCount, error) => {
      const status = (error as { status?: number }).status;
      if (status === 401 || status === 403 || status === 404) return false;
      return failureCount < 1;
    }
  });
}
