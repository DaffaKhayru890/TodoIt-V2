import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { todoKeys } from '@/features/todos/api/todo.query-keys';
import { makeReminderDto } from '@/test/fixtures/reminders';
import { server } from '@/test/mocks/server';
import { reminderKeys } from '../api/reminder.query-keys';
import { useCancelReminder, useCreateReminder, useUpdateReminder } from './use-reminder-mutations';
import { useTodoReminders } from './use-todo-reminders';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const reminderId = 'c1111111-1111-4111-8111-111111111111';

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

describe('reminder hooks', () => {
  test('useTodoReminders default meminta reminder scheduled dengan limit 100', async () => {
    server.use(
      http.get(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders`,
        ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('status')).toBe('scheduled');
          expect(url.searchParams.get('limit')).toBe('100');

          return HttpResponse.json({
            items: [makeReminderDto()],
            pagination: { limit: 100, hasMore: false, nextCursor: null }
          });
        }
      )
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTodoReminders(workspaceId, todoId), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.items[0]?.triggerType).toBe('before_due');
  });

  test('useTodoReminders tidak retry pada 404', async () => {
    let calls = 0;
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders`, () => {
        calls += 1;
        return HttpResponse.json(
          {
            error: {
              code: 'TODO_NOT_FOUND',
              message: 'Todo tidak ditemukan.',
              requestId: 'req-404'
            }
          },
          { status: 404 }
        );
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useTodoReminders(workspaceId, todoId), { wrapper });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(calls).toBe(1);
  });

  test('useCreateReminder mengisi cache detail dan menginvalidasi reminder/todo', async () => {
    const created = makeReminderDto({ offsetMinutes: 30 });
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders`, () =>
        HttpResponse.json({ reminder: created }, { status: 201 })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCreateReminder(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        workspaceId,
        todoId,
        input: { triggerType: 'before_due', offsetMinutes: 30 }
      });
    });

    expect(setDataSpy).toHaveBeenCalledWith(
      reminderKeys.detail(workspaceId, todoId, created.id),
      expect.objectContaining({ id: created.id })
    );
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: reminderKeys.todoLists(workspaceId, todoId)
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.detail(workspaceId, todoId)
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.workspaceLists(workspaceId)
    });
  });

  test('useUpdateReminder memperbarui cache detail', async () => {
    const updated = makeReminderDto({ offsetMinutes: 60 });
    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders/${reminderId}`,
        () => HttpResponse.json({ reminder: updated })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const setDataSpy = vi.spyOn(queryClient, 'setQueryData');
    const { result } = renderHook(() => useUpdateReminder(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        workspaceId,
        todoId,
        reminderId,
        input: { offsetMinutes: 60 }
      });
    });

    expect(setDataSpy).toHaveBeenCalledWith(
      reminderKeys.detail(workspaceId, todoId, reminderId),
      expect.objectContaining({ offsetMinutes: 60 })
    );
  });

  test('useCancelReminder menghapus cache detail dan menginvalidasi list', async () => {
    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders/${reminderId}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const removeSpy = vi.spyOn(queryClient, 'removeQueries');
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const { result } = renderHook(() => useCancelReminder(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ workspaceId, todoId, reminderId });
    });

    expect(removeSpy).toHaveBeenCalledWith({
      queryKey: reminderKeys.detail(workspaceId, todoId, reminderId)
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: reminderKeys.todoLists(workspaceId, todoId)
    });
  });
});
