import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { todoKeys } from '../api/todo.query-keys';
import { useCompleteTodo } from './use-complete-todo';
import { useCreateTodo } from './use-create-todo';
import { useDeleteTodo } from './use-delete-todo';
import { useReopenTodo } from './use-reopen-todo';
import { useTodo } from './use-todo';
import { useUpdateTodo } from './use-update-todo';
import { useWorkspaceTodos } from './use-workspace-todos';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
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

describe('Todo query & mutation hooks', () => {
  test('useWorkspaceTodos mengambil halaman pertama dan mengembalikan domain model', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('limit')).toBe('100');

        return HttpResponse.json({
          items: [makeTodoDto()],
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWorkspaceTodos(workspaceId), { wrapper });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.items).toHaveLength(1);
    expect(result.current.data?.items[0]?.title).toBe('Tugas contoh');
    expect(result.current.data?.pagination.hasMore).toBe(false);
  });

  test('useWorkspaceTodos tidak retry pada 404', async () => {
    let calls = 0;

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () => {
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

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useWorkspaceTodos(workspaceId), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status: 404 });
    expect(calls).toBe(1);
  });

  test('useTodo mengambil detail berdasarkan workspace dan todo id', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        return HttpResponse.json({ todo: makeTodoDto({ id: todoId }) });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTodo(workspaceId, todoId), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.id).toBe(todoId);
  });

  test('useCreateTodo mengisi detail cache dan menginvalidasi list workspace yang tepat', async () => {
    const created = makeTodoDto({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () => {
        return HttpResponse.json({ todo: created }, { status: 201 });
      })
    );

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const { result } = renderHook(() => useCreateTodo(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        workspaceId,
        input: { title: 'Tugas baru', description: null }
      });
    });

    expect(setDataSpy).toHaveBeenCalledWith(
      todoKeys.detail(workspaceId, created.id),
      expect.objectContaining({ id: created.id })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.workspaceLists(workspaceId)
    });
  });

  test('useUpdateTodo memperbarui detail cache dan menginvalidasi list', async () => {
    const updated = makeTodoDto({ title: 'Judul baru' });

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () =>
        HttpResponse.json({ todo: updated })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const { result } = renderHook(() => useUpdateTodo(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        workspaceId,
        todoId,
        input: { title: 'Judul baru' }
      });
    });

    expect(setDataSpy).toHaveBeenCalledWith(
      todoKeys.detail(workspaceId, todoId),
      expect.objectContaining({ title: 'Judul baru' })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.workspaceLists(workspaceId)
    });
  });

  test('useCompleteTodo memanggil complete dan memperbarui cache', async () => {
    const completed = makeTodoDto({
      status: 'completed',
      completedAt: '2026-11-07T12:00:00.000Z'
    });

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/complete`, () =>
        HttpResponse.json({ todo: completed })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const { result } = renderHook(() => useCompleteTodo(), { wrapper });

    let returned: Awaited<ReturnType<typeof result.current.mutateAsync>> | undefined;

    await act(async () => {
      returned = await result.current.mutateAsync({ workspaceId, todoId });
    });

    expect(returned?.status).toBe('completed');
    expect(setDataSpy).toHaveBeenCalledWith(
      todoKeys.detail(workspaceId, todoId),
      expect.objectContaining({ status: 'completed' })
    );
  });

  test('useReopenTodo mengirim PATCH status todo', async () => {
    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`,
        async ({ request }) => {
          const body = (await request.json()) as { status: string };
          expect(body).toEqual({ status: 'todo' });
          return HttpResponse.json({ todo: makeTodoDto({ status: 'todo' }) });
        }
      )
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useReopenTodo(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ workspaceId, todoId });
    });

    expect(result.current.data?.status).toBe('todo');
  });

  test('useDeleteTodo menghapus detail cache dan menginvalidasi list', async () => {
    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteTodo(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ workspaceId, todoId });
    });

    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.detail(workspaceId, todoId)
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.workspaceLists(workspaceId)
    });
  });

  test('mutation Workspace B tidak mengubah cache Workspace A', async () => {
    const workspaceA = '11111111-1111-4111-8111-111111111111';
    const workspaceB = '22222222-2222-4222-8222-222222222222';
    const todoA = makeTodoDto({ id: 'a-todo', workspaceId: workspaceA, title: 'Milik A' });
    const todoB = makeTodoDto({ id: 'b-todo', workspaceId: workspaceB, title: 'Milik B' });
    const updatedB = { ...todoB, title: 'Milik B diperbarui' };

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceB}/todos/${todoB.id}`, () =>
        HttpResponse.json({ todo: updatedB })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const listKeyA = todoKeys.workspace(workspaceA, { limit: 100 });
    const listKeyB = todoKeys.workspace(workspaceB, { limit: 100 });

    queryClient.setQueryData(listKeyA, {
      items: [todoA],
      pagination: { limit: 100, hasMore: false, nextCursor: null }
    });
    queryClient.setQueryData(listKeyB, {
      items: [todoB],
      pagination: { limit: 100, hasMore: false, nextCursor: null }
    });

    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateTodo(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        workspaceId: workspaceB,
        todoId: todoB.id,
        input: { title: 'Milik B diperbarui' }
      });
    });

    expect(queryClient.getQueryData(listKeyA)).toEqual({
      items: [todoA],
      pagination: { limit: 100, hasMore: false, nextCursor: null }
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.workspaceLists(workspaceB)
    });
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: todoKeys.workspaceLists(workspaceA)
    });
  });
});
