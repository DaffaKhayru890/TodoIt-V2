import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { workspaceKeys } from '../api/workspace.query-keys';
import { server } from '@/test/mocks/server';
import { useArchiveWorkspace } from './use-archive-workspace';
import { useCreateWorkspace } from './use-create-workspace';
import { useUpdateWorkspace } from './use-update-workspace';
import { useWorkspace } from './use-workspace';
import { useWorkspaces } from './use-workspaces';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  };
}

describe('Workspace query & mutation hooks', () => {
  const baseUrl = 'http://localhost:4000';

  beforeEach(() => {
    server.resetHandlers();
  });

  test('useWorkspaces mengembalikan daftar workspace', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces`, () => {
        return HttpResponse.json({
          items: [
            {
              id: 'ws-1',
              name: 'Personal',
              description: null,
              role: 'owner',
              createdAt: '2026-11-07T10:00:00.000Z'
            }
          ],
          pagination: { limit: 20, offset: 0, total: 1 }
        });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWorkspaces(), { wrapper });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0]?.name).toBe('Personal');
  });

  test('useWorkspace mengembalikan detail workspace', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/ws-1`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-1',
            name: 'Personal Detail',
            description: 'Detail text',
            role: 'owner',
            createdAt: '2026-11-07T10:00:00.000Z',
            updatedAt: '2026-11-07T10:00:00.000Z',
            archivedAt: null
          }
        });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWorkspace('ws-1'), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.name).toBe('Personal Detail');
  });

  test('useWorkspace tidak retry pada 404 dan mengisolasi cache per ID', async () => {
    let calls = 0;

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/ws-missing`, () => {
        calls += 1;
        return HttpResponse.json(
          {
            error: {
              code: 'WORKSPACE_ACCESS_DENIED',
              message: 'Workspace tidak ditemukan.',
              requestId: 'req-404'
            }
          },
          { status: 404 }
        );
      })
    );

    const { wrapper, queryClient } = createWrapper();
    const { result } = renderHook(() => useWorkspace('ws-missing'), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({ status: 404 });
    expect(calls).toBe(1);
    expect(queryClient.getQueryState(workspaceKeys.detail('ws-missing'))).toBeDefined();
    expect(queryClient.getQueryState(workspaceKeys.detail('ws-other'))).toBeUndefined();
  });

  test('useCreateWorkspace melakukan mutasi dan memperbarui cache', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces`, () => {
        return HttpResponse.json(
          {
            workspace: {
              id: 'ws-new',
              name: 'Baru',
              description: null,
              role: 'owner',
              createdAt: '2026-11-07T10:00:00.000Z',
              updatedAt: '2026-11-07T10:00:00.000Z',
              archivedAt: null
            }
          },
          { status: 201 }
        );
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useCreateWorkspace(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Baru' });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('ws-new');
  });

  test('useUpdateWorkspace melakukan pembaruan', async () => {
    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/ws-1`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-1',
            name: 'Updated Name',
            description: null,
            role: 'owner',
            createdAt: '2026-11-07T10:00:00.000Z',
            updatedAt: '2026-11-07T12:00:00.000Z',
            archivedAt: null
          }
        });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUpdateWorkspace(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        workspaceId: 'ws-1',
        input: { name: 'Updated Name' }
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.name).toBe('Updated Name');
  });

  test('useArchiveWorkspace melakukan pengarsipan', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/ws-1/archive`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-1',
            archivedAt: '2026-11-07T14:00:00.000Z'
          }
        });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useArchiveWorkspace(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('ws-1');
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe('ws-1');
  });

  test('useWorkspaces menyajikan error tanpa retry berulang untuk 401', async () => {
    let calls = 0;

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces`, () => {
        calls += 1;
        return HttpResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Sesi tidak valid.',
              requestId: 'req-401'
            }
          },
          { status: 401 }
        );
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWorkspaces(), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(result.current.error).toMatchObject({ status: 401, code: 'UNAUTHORIZED' });
    expect(calls).toBe(1);
  });

  test('useCreateWorkspace menginvalidasi list dan mengisi detail cache', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces`, () => {
        return HttpResponse.json(
          {
            workspace: {
              id: 'ws-created-cache',
              name: 'Cache Baru',
              description: null,
              role: 'owner',
              createdAt: '2026-11-07T10:00:00.000Z',
              updatedAt: '2026-11-07T10:00:00.000Z',
              archivedAt: null
            }
          },
          { status: 201 }
        );
      })
    );

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const { result } = renderHook(() => useCreateWorkspace(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Cache Baru' });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: workspaceKeys.lists() });
    expect(setDataSpy).toHaveBeenCalledWith(
      workspaceKeys.detail('ws-created-cache'),
      expect.objectContaining({ id: 'ws-created-cache', name: 'Cache Baru' })
    );
  });

  test('useUpdateWorkspace memperbarui detail cache dan invalidasi list', async () => {
    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/ws-1`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-1',
            name: 'Nama Cache',
            description: null,
            role: 'owner',
            createdAt: '2026-11-07T10:00:00.000Z',
            updatedAt: '2026-11-07T12:00:00.000Z',
            archivedAt: null
          }
        });
      })
    );

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const { result } = renderHook(() => useUpdateWorkspace(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        workspaceId: 'ws-1',
        input: { name: 'Nama Cache' }
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: workspaceKeys.lists() });
    expect(setDataSpy).toHaveBeenCalledWith(
      workspaceKeys.detail('ws-1'),
      expect.objectContaining({ id: 'ws-1', name: 'Nama Cache' })
    );
  });

  test('useArchiveWorkspace menghapus detail cache dan invalidasi list', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/ws-1/archive`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-1',
            archivedAt: '2026-11-07T14:00:00.000Z'
          }
        });
      })
    );

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');
    const { result } = renderHook(() => useArchiveWorkspace(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync('ws-1');
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: workspaceKeys.lists() });
    expect(removeSpy).toHaveBeenCalledWith({ queryKey: workspaceKeys.detail('ws-1') });
  });
});
