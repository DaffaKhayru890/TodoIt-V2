import { useQuery } from '@tanstack/react-query';
import { workspaceApi } from '@/features/workspaces/api/workspace.api';
import type { SearchWorkspace } from '../models/search.model';
import { searchKeys } from '../api/search.query-keys';

const WORKSPACE_PAGE_SIZE = 50;
const MAX_WORKSPACE_PAGES = 10;

/**
 * Mengambil seluruh workspace aktif dengan offset pagination backend.
 * Backend membatasi limit workspace maksimum 50 dan tidak menyediakan
 * parameter pencarian nama, sehingga daftar lengkap diperlukan agar fan-out
 * pencarian tidak melewatkan workspace.
 */
export async function fetchAllSearchWorkspaces(): Promise<readonly SearchWorkspace[]> {
  const result: SearchWorkspace[] = [];
  let offset = 0;

  for (let page = 0; page < MAX_WORKSPACE_PAGES; page += 1) {
    const response = await workspaceApi.getAll({ limit: WORKSPACE_PAGE_SIZE, offset });

    result.push(...response.items.map((workspace) => ({ id: workspace.id, name: workspace.name })));
    offset += response.items.length;

    if (
      response.items.length === 0 ||
      offset >= response.pagination.total ||
      response.pagination.total === 0
    ) {
      break;
    }
  }

  return result;
}

export function useSearchWorkspaces() {
  return useQuery({
    queryKey: searchKeys.workspaces(),
    queryFn: fetchAllSearchWorkspaces,
    staleTime: 60_000
  });
}
