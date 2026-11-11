import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { KeyboardEvent, ReactNode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { makeLabelDto } from '@/test/fixtures/labels';
import { makeTagDto } from '@/test/fixtures/tags';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { SEARCH_DEBOUNCE_MS, SEARCH_RECENT_STORAGE_KEY } from '../models/search.model';
import { useGlobalSearch } from './use-global-search';
import { useRecentSearches } from './use-recent-searches';
import { useSearchKeyboard } from './use-search-keyboard';
import { useSearchShortcut } from './use-search-shortcut';
import { useSearchWorkspaces } from './use-search-workspaces';

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

function keyboardEvent(key: string) {
  return {
    key,
    preventDefault: vi.fn()
  } as unknown as KeyboardEvent<HTMLInputElement>;
}

describe('Search hooks', () => {
  afterEach(() => {
    localStorage.clear();
  });

  test('useSearchWorkspaces mengambil seluruh halaman offset sampai total terpenuhi', async () => {
    let callCount = 0;

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces`, ({ request }) => {
        const url = new URL(request.url);
        const offset = Number(url.searchParams.get('offset') ?? '0');
        callCount += 1;

        expect(url.searchParams.get('limit')).toBe('50');
        expect(offset).toBeLessThanOrEqual(1);

        const items =
          offset === 0
            ? [
                {
                  id: workspaceId,
                  name: 'Personal',
                  description: null,
                  role: 'owner',
                  createdAt: '2026-11-01T00:00:00.000Z'
                }
              ]
            : [
                {
                  id: '22222222-2222-4222-8222-222222222222',
                  name: 'Kerja',
                  description: null,
                  role: 'owner',
                  createdAt: '2026-11-01T00:00:00.000Z'
                }
              ];

        return HttpResponse.json({
          items,
          pagination: { limit: 50, offset, total: 2 }
        });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useSearchWorkspaces(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual([
      { id: workspaceId, name: 'Personal' },
      { id: '22222222-2222-4222-8222-222222222222', name: 'Kerja' }
    ]);
    expect(callCount).toBe(2);
  });

  test('useGlobalSearch mendedebounce query lalu menjalankan fan-out', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () =>
        HttpResponse.json({
          items: [makeTodoDto({ title: 'Backend integration' })],
          pagination: { limit: 8, hasMore: false, nextCursor: null }
        })
      ),
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () =>
        HttpResponse.json({
          items: [makeTagDto({ name: 'backend' })],
          pagination: { limit: 5, hasMore: false, nextCursor: null }
        })
      ),
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () =>
        HttpResponse.json({
          items: [makeLabelDto({ name: 'Backend layer' })],
          pagination: { limit: 5, hasMore: false, nextCursor: null }
        })
      )
    );

    const { wrapper } = createWrapper();
    const workspaces = [{ id: workspaceId, name: 'Personal' }];
    const { result } = renderHook(() => useGlobalSearch('  backend  ', workspaces), {
      wrapper
    });

    expect(result.current.normalizedQuery).toBe('backend');

    await waitFor(() => expect(result.current.searchQuery.isSuccess).toBe(true), {
      timeout: SEARCH_DEBOUNCE_MS + 3000
    });

    expect(result.current.debouncedQuery).toBe('backend');
    expect(result.current.isDebouncing).toBe(false);
    expect(result.current.searchQuery.data?.total).toBe(3);
  });

  test('useGlobalSearch tidak menjalankan query di bawah panjang minimum', async () => {
    const { wrapper } = createWrapper();
    const workspaces = [{ id: workspaceId, name: 'Personal' }];
    const { result } = renderHook(() => useGlobalSearch('b', workspaces), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, SEARCH_DEBOUNCE_MS + 100));

    expect(result.current.isQueryTooShort).toBe(true);
    expect(result.current.searchQuery.fetchStatus).toBe('idle');
    expect(result.current.searchQuery.data).toBeUndefined();
  });

  test('useRecentSearches membaca, menambah, menghapus, dan membersihkan riwayat', () => {
    localStorage.setItem(SEARCH_RECENT_STORAGE_KEY, JSON.stringify(['design']));

    const { result } = renderHook(() => useRecentSearches());

    expect(result.current.items).toEqual(['design']);

    act(() => {
      result.current.addSearch('backend');
    });

    expect(result.current.items).toEqual(['backend', 'design']);
    expect(JSON.parse(localStorage.getItem(SEARCH_RECENT_STORAGE_KEY) ?? '[]')).toEqual([
      'backend',
      'design'
    ]);

    act(() => {
      result.current.removeSearch('BACKEND');
    });

    expect(result.current.items).toEqual(['design']);

    act(() => {
      result.current.clearSearches();
    });

    expect(result.current.items).toEqual([]);
    expect(localStorage.getItem(SEARCH_RECENT_STORAGE_KEY)).toBeNull();
  });

  test('useSearchKeyboard mengelola navigasi, seleksi, submit, dan reset', () => {
    const onSelect = vi.fn();
    const onSubmit = vi.fn();

    const { result, rerender } = renderHook(
      ({ resetKey }) => useSearchKeyboard({ itemCount: 3, resetKey, onSelect, onSubmit }),
      { initialProps: { resetKey: 'backend' } }
    );

    const down = keyboardEvent('ArrowDown');
    act(() => {
      result.current.handleKeyDown(down);
    });
    expect(down.preventDefault).toHaveBeenCalled();
    expect(result.current.activeIndex).toBe(0);

    act(() => {
      result.current.handleKeyDown(keyboardEvent('ArrowDown'));
    });
    expect(result.current.activeIndex).toBe(1);

    act(() => {
      result.current.handleKeyDown(keyboardEvent('End'));
    });
    expect(result.current.activeIndex).toBe(2);

    act(() => {
      result.current.handleKeyDown(keyboardEvent('ArrowDown'));
    });
    expect(result.current.activeIndex).toBe(0);

    act(() => {
      result.current.handleKeyDown(keyboardEvent('ArrowUp'));
    });
    expect(result.current.activeIndex).toBe(2);

    act(() => {
      result.current.handleKeyDown(keyboardEvent('Home'));
    });
    expect(result.current.activeIndex).toBe(0);

    act(() => {
      result.current.handleKeyDown(keyboardEvent('Enter'));
    });
    expect(onSelect).toHaveBeenCalledWith(0);
    expect(onSubmit).not.toHaveBeenCalled();

    rerender({ resetKey: 'frontend' });
    expect(result.current.activeIndex).toBe(-1);

    act(() => {
      result.current.handleKeyDown(keyboardEvent('Enter'));
    });
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  test('useSearchKeyboard mengabaikan navigasi ketika tidak ada item', () => {
    const { result } = renderHook(() =>
      useSearchKeyboard({ itemCount: 0, resetKey: 'x', onSelect: vi.fn(), onSubmit: vi.fn() })
    );

    const event = keyboardEvent('ArrowDown');
    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(result.current.activeIndex).toBe(-1);
    expect(event.preventDefault).not.toHaveBeenCalled();
  });

  test('useSearchShortcut membuka pencarian melalui Ctrl+K dan mengabaikan input', () => {
    const onOpen = vi.fn();

    renderHook(() => useSearchShortcut(onOpen));

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
    expect(onOpen).toHaveBeenCalledTimes(1);

    const input = document.createElement('input');
    document.body.appendChild(input);

    fireEvent.keyDown(input, { key: 'k', ctrlKey: true });
    expect(onOpen).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true, altKey: true });
    expect(onOpen).toHaveBeenCalledTimes(1);

    input.remove();
  });

  test('useSearchShortcut tidak aktif ketika disabled', () => {
    const onOpen = vi.fn();

    renderHook(() => useSearchShortcut(onOpen, false));

    fireEvent.keyDown(document, { key: 'k', ctrlKey: true });

    expect(onOpen).not.toHaveBeenCalled();
  });
});
