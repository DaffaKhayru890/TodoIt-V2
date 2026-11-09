import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { todoKeys } from '@/features/todos/api/todo.query-keys';
import { makeTagDto } from '@/test/fixtures/tags';
import { server } from '@/test/mocks/server';
import { tagKeys } from '../api/tag.query-keys';
import {
  useCreateTag,
  useDeleteTag,
  useReplaceTodoTags,
  useUpdateTag
} from './use-tag-mutations';
import { useTags } from './use-tags';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const tagId = 'a1111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
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

describe('tag hooks', () => {
  test('useTags mengambil halaman pertama dengan limit default', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('limit')).toBe('100');
        return HttpResponse.json({
          items: [makeTagDto()],
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTags(workspaceId), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0]?.name).toBe('backend');
  });

  test('useTags tidak retry pada 404', async () => {
    let calls = 0;
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () => {
        calls += 1;
        return HttpResponse.json(
          {
            error: {
              code: 'WORKSPACE_NOT_FOUND',
              message: 'Workspace tidak ditemukan.',
              requestId: 'req-404'
            }
          },
          { status: 404 }
        );
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTags(workspaceId), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(calls).toBe(1);
  });

  test('useCreateTag menginvalidasi list tag workspace', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () =>
        HttpResponse.json({ tag: makeTagDto() }, { status: 201 })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateTag(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ workspaceId, input: { name: 'backend' } });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tagKeys.workspaceLists(workspaceId)
    });
  });

  test('useUpdateTag menginvalidasi list, detail, dan cache todo', async () => {
    const updated = makeTagDto({ name: 'Backend API' });
    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags/${tagId}`, () =>
        HttpResponse.json({ tag: updated })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateTag(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        workspaceId,
        tagId,
        input: { name: 'Backend API' }
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tagKeys.workspaceLists(workspaceId)
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tagKeys.detail(workspaceId, tagId)
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.workspaceLists(workspaceId)
    });
  });

  test('useDeleteTag menghapus detail dan menginvalidasi cache terkait', async () => {
    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/tags/${tagId}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteTag(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ workspaceId, tagId });
    });

    expect(removeSpy).toHaveBeenCalledWith({ queryKey: tagKeys.detail(workspaceId, tagId) });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: tagKeys.workspaceLists(workspaceId)
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.workspaceLists(workspaceId)
    });
  });

  test('useReplaceTodoTags mengirim seluruh tag dan menginvalidasi todo', async () => {
    server.use(
      http.put(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/tags`,
        async ({ request }) => {
          expect(await request.json()).toEqual({ tagIds: [tagId] });
          return HttpResponse.json({ tags: [{ id: tagId, name: 'backend' }] });
        }
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useReplaceTodoTags(), { wrapper });

    let returned: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;

    await act(async () => {
      returned = await result.current.mutateAsync({ workspaceId, todoId, tagIds: [tagId] });
    });

    expect(returned).toEqual([{ id: tagId, name: 'backend' }]);
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.detail(workspaceId, todoId)
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.workspaceLists(workspaceId)
    });
  });
});
