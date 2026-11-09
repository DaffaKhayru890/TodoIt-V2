import { QueryClient } from '@tanstack/react-query';
import { describe, expect, test, vi } from 'vitest';
import { todoKeys } from '../api/todo.query-keys';
import { invalidateTodoCachesForWorkspace } from './invalidate-todo-cache';

describe('invalidateTodoCachesForWorkspace', () => {
  test('menginvalidasi seluruh list/view dan detail workspace terkait', () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    invalidateTodoCachesForWorkspace(queryClient, 'workspace-1');

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.workspaceLists('workspace-1')
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: todoKeys.details(),
      predicate: expect.any(Function)
    });
  });

  test('predicate detail hanya cocok untuk workspace yang sama', () => {
    const queryClient = new QueryClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');

    invalidateTodoCachesForWorkspace(queryClient, 'workspace-1');

    const call = invalidateSpy.mock.calls.find(
      ([filters]) => (filters as { predicate?: unknown }).predicate !== undefined
    )?.[0] as { predicate: (query: { queryKey: readonly unknown[] }) => boolean };

    expect(call.predicate({ queryKey: todoKeys.detail('workspace-1', 'todo-1') })).toBe(true);
    expect(call.predicate({ queryKey: todoKeys.detail('workspace-2', 'todo-1') })).toBe(false);
  });
});
