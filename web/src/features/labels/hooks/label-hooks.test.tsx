import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { todoKeys } from '@/features/todos/api/todo.query-keys';
import { makeLabelDto } from '@/test/fixtures/labels';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { labelKeys } from '../api/label.query-keys';
import {
  useAssignTodoLabel,
  useClearTodoLabel,
  useCreateLabel,
  useDeleteLabel,
  useUpdateLabel
} from './use-label-mutations';
import { useLabels } from './use-labels';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const labelId = 'b1111111-1111-4111-8111-111111111111';
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

describe('label hooks', () => {
  test('useLabels mengambil halaman pertama dengan limit default', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('limit')).toBe('100');
        return HttpResponse.json({
          items: [makeLabelDto()],
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLabels(workspaceId), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0]?.name).toBe('Bug');
  });

  test('useLabels tidak retry pada 403', async () => {
    let calls = 0;
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () => {
        calls += 1;
        return HttpResponse.json(
          {
            error: {
              code: 'WORKSPACE_PERMISSION_DENIED',
              message: 'Tidak berwenang.',
              requestId: 'req-403'
            }
          },
          { status: 403 }
        );
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useLabels(workspaceId), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(calls).toBe(1);
  });

  test('useCreateLabel menginvalidasi list label', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () =>
        HttpResponse.json({ label: makeLabelDto() }, { status: 201 })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateLabel(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        workspaceId,
        input: { name: 'Bug', color: '#E74C3C', description: null }
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: labelKeys.workspaceLists(workspaceId)
    });
  });

  test('useUpdateLabel menginvalidasi list, detail, dan cache todo', async () => {
    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels/${labelId}`, () =>
        HttpResponse.json({ label: makeLabelDto({ name: 'Defect' }) })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateLabel(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        workspaceId,
        labelId,
        input: { name: 'Defect' }
      });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: labelKeys.workspaceLists(workspaceId)
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: labelKeys.detail(workspaceId, labelId)
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.workspaceLists(workspaceId)
    });
  });

  test('useDeleteLabel menghapus detail dan menginvalidasi cache terkait', async () => {
    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/labels/${labelId}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteLabel(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ workspaceId, labelId });
    });

    expect(removeSpy).toHaveBeenCalledWith({ queryKey: labelKeys.detail(workspaceId, labelId) });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: labelKeys.workspaceLists(workspaceId)
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.workspaceLists(workspaceId)
    });
  });

  test('useAssignTodoLabel menyimpan detail todo dan menginvalidasi list', async () => {
    const updated = makeTodoDto({
      label: { id: labelId, name: 'Bug', color: '#E74C3C' }
    });

    server.use(
      http.put(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/label`, () =>
        HttpResponse.json({ todo: updated })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useAssignTodoLabel(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ workspaceId, todoId, labelId });
    });

    expect(setDataSpy).toHaveBeenCalledWith(
      todoKeys.detail(workspaceId, todoId),
      expect.objectContaining({ id: todoId })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.workspaceLists(workspaceId)
    });
  });

  test('useClearTodoLabel menyimpan detail todo tanpa label', async () => {
    server.use(
      http.delete(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/label`, () =>
        HttpResponse.json({ todo: makeTodoDto({ label: null }) })
      )
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useClearTodoLabel(), { wrapper });

    let returned: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;

    await act(async () => {
      returned = await result.current.mutateAsync({ workspaceId, todoId });
    });

    expect(returned?.label).toBeNull();
  });
});
