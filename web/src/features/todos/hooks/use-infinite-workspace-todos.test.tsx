import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { todoKeys } from '../api/todo.query-keys';
import { TODO_INFINITE_PAGE_SIZE, useInfiniteWorkspaceTodos } from './use-infinite-workspace-todos';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';

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

describe('useInfiniteWorkspaceTodos', () => {
  test('memakai cursor backend dan menggabungkan halaman', async () => {
    const requests: { limit: string | null; cursor: string | null; sort: string | null }[] = [];

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, ({ request }) => {
        const url = new URL(request.url);
        const cursor = url.searchParams.get('cursor');

        requests.push({
          limit: url.searchParams.get('limit'),
          cursor,
          sort: url.searchParams.get('sort')
        });

        return HttpResponse.json({
          items: [
            makeTodoDto({
              id: cursor
                ? 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
                : 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
              title: cursor ? 'Halaman dua' : 'Halaman satu'
            })
          ],
          pagination: {
            limit: TODO_INFINITE_PAGE_SIZE,
            hasMore: cursor === null,
            nextCursor: cursor === null ? 'cursor-2' : null
          }
        });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () =>
        useInfiniteWorkspaceTodos(workspaceId, undefined, {
          sort: { field: 'title', direction: 'asc' }
        }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.hasNextPage).toBe(true);
    expect(requests[0]).toEqual({ limit: '30', cursor: null, sort: null });

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(requests[1]).toEqual({ limit: '30', cursor: 'cursor-2', sort: null });
    expect(result.current.data?.pages[1]?.items[0]?.title).toBe('Halaman dua');
  });

  test('tidak mengirim cursor dari parameter pemanggil', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('cursor')).toBeNull();
        expect(url.searchParams.get('limit')).toBe('30');

        return HttpResponse.json({
          items: [],
          pagination: { limit: 30, hasMore: false, nextCursor: null }
        });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(
      () => useInfiniteWorkspaceTodos(workspaceId, { cursor: 'cursor-lama' }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.hasNextPage).toBe(false);
  });

  test('sort masuk query key sehingga pagination direset saat sorting berubah', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () =>
        HttpResponse.json({
          items: [],
          pagination: { limit: 30, hasMore: false, nextCursor: null }
        })
      )
    );

    const { wrapper } = createWrapper();
    const { result, rerender } = renderHook(
      ({ field }) =>
        useInfiniteWorkspaceTodos(workspaceId, undefined, {
          sort: { field, direction: 'asc' }
        }),
      { wrapper, initialProps: { field: 'title' } }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const firstKey = todoKeys.workspaceInfinite(workspaceId, {
      params: { limit: TODO_INFINITE_PAGE_SIZE },
      sort: { field: 'title', direction: 'asc' }
    });

    rerender({ field: 'priority' });

    const secondKey = todoKeys.workspaceInfinite(workspaceId, {
      params: { limit: TODO_INFINITE_PAGE_SIZE },
      sort: { field: 'priority', direction: 'asc' }
    });

    expect(firstKey).not.toEqual(secondKey);
  });
});
