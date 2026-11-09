import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, test } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { useOverdueTodos } from './use-overdue-todos';
import { useTodayTodos } from './use-today-todos';
import { useUpcomingTodos } from './use-upcoming-todos';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity }
    }
  });

  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function listResponse() {
  return {
    items: [makeTodoDto()],
    pagination: { limit: 100, hasMore: false, nextCursor: null }
  };
}

describe('todo view hooks', () => {
  test('useTodayTodos mengirim timezone, includeCompleted, dan limit default', async () => {
    server.use(
      http.get(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/today`,
        ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('timezone')).toBe('Asia/Jakarta');
          expect(url.searchParams.get('includeCompleted')).toBe('true');
          expect(url.searchParams.get('limit')).toBe('100');
          return HttpResponse.json(listResponse());
        }
      )
    );

    const { result } = renderHook(
      () => useTodayTodos(workspaceId, { timezone: 'Asia/Jakarta', includeCompleted: true }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items).toHaveLength(1);
  });

  test('useUpcomingTodos mengirim days dan filter metadata', async () => {
    server.use(
      http.get(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/upcoming`,
        ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('days')).toBe('30');
          expect(url.searchParams.get('limit')).toBe('100');
          expect(url.searchParams.getAll('tagIds')).toEqual(['tag-1', 'tag-2']);
          expect(url.searchParams.get('labelId')).toBe('label-1');
          return HttpResponse.json(listResponse());
        }
      )
    );

    const { result } = renderHook(
      () =>
        useUpcomingTodos(workspaceId, {
          days: 30,
          tagIds: ['tag-1', 'tag-2'],
          labelId: 'label-1'
        }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  test('useOverdueTodos mengirim timezone dan limit default', async () => {
    server.use(
      http.get(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/overdue`,
        ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('timezone')).toBe('Asia/Jakarta');
          expect(url.searchParams.get('limit')).toBe('100');
          return HttpResponse.json(listResponse());
        }
      )
    );

    const { result } = renderHook(
      () => useOverdueTodos(workspaceId, { timezone: 'Asia/Jakarta' }),
      { wrapper: createWrapper() }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });

  test('view hooks tidak berjalan tanpa workspaceId', () => {
    const wrapper = createWrapper();

    const today = renderHook(() => useTodayTodos(''), { wrapper });
    const upcoming = renderHook(() => useUpcomingTodos(''), { wrapper });
    const overdue = renderHook(() => useOverdueTodos(''), { wrapper });

    expect(today.result.current.fetchStatus).toBe('idle');
    expect(upcoming.result.current.fetchStatus).toBe('idle');
    expect(overdue.result.current.fetchStatus).toBe('idle');
  });
});
