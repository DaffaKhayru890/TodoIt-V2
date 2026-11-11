import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { ToastProvider } from '@/components/ui/toast/toast-provider';
import { makeNotificationDto } from '@/test/fixtures/notifications';
import { server } from '@/test/mocks/server';
import { notificationKeys } from '../api/notification.query-keys';
import type { AppNotification } from '../models/notification.model';
import {
  readBrowserNotificationPermission,
  resetShownBrowserNotificationIds,
  useBrowserNotifications
} from './use-browser-notifications';
import { useNotificationFeed } from './use-notification-feed';
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences
} from './use-notification-preferences';
import { useNotificationUpdates } from './use-notification-updates';
import {
  useMarkAllNotificationsAsRead,
  useMarkNotificationAsRead,
  useNotifications,
  useUnreadNotificationCount
} from './use-notifications';

const baseUrl = 'http://localhost:4000';

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

function createToastWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false }
    }
  });

  return {
    queryClient,
    wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>{children}</ToastProvider>
      </QueryClientProvider>
    )
  };
}

function appNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    type: 'todo_due_soon',
    title: 'Tenggat mendekat',
    body: 'Tugas segera jatuh tempo.',
    data: {},
    readAt: null,
    createdAt: new Date('2026-11-11T09:30:00.000Z'),
    ...overrides
  };
}

class FakeNotification {
  static permission: NotificationPermission = 'granted';
  static requestPermission = vi.fn(async () => 'granted' as NotificationPermission);
  static instances: FakeNotification[] = [];

  onclick: (() => void) | null = null;
  close = vi.fn();

  constructor(
    readonly title: string,
    readonly options?: NotificationOptions
  ) {
    FakeNotification.instances.push(this);
  }
}

describe('Notification hooks', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetShownBrowserNotificationIds();
    FakeNotification.instances = [];
    FakeNotification.permission = 'granted';
  });

  test('useNotifications mengambil halaman berikutnya memakai cursor backend', async () => {
    const cursors: (string | null)[] = [];

    server.use(
      http.get(`${baseUrl}/api/v1/notifications`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        cursors.push(cursor);

        if (!cursor) {
          return HttpResponse.json({
            items: [makeNotificationDto({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' })],
            pagination: { limit: 20, hasMore: true, nextCursor: 'cursor-2' }
          });
        }

        return HttpResponse.json({
          items: [makeNotificationDto({ id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' })],
          pagination: { limit: 20, hasMore: false, nextCursor: null }
        });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useNotifications({ readStatus: 'unread' }), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.pages).toHaveLength(1);
    expect(result.current.hasNextPage).toBe(true);

    await act(async () => {
      await result.current.fetchNextPage();
    });

    await waitFor(() => expect(result.current.data?.pages).toHaveLength(2));
    expect(result.current.hasNextPage).toBe(false);
    expect(cursors).toEqual([null, 'cursor-2']);
  });

  test('useNotifications tidak berjalan ketika disabled', async () => {
    let requests = 0;

    server.use(
      http.get(`${baseUrl}/api/v1/notifications`, () => {
        requests += 1;
        return HttpResponse.json({
          items: [],
          pagination: { limit: 20, hasMore: false, nextCursor: null }
        });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useNotifications({ enabled: false }), { wrapper });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(result.current.fetchStatus).toBe('idle');
    expect(requests).toBe(0);
  });

  test('useUnreadNotificationCount membaca endpoint terpisah', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/notifications/unread-count`, () =>
        HttpResponse.json({ unreadCount: 5 })
      )
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useUnreadNotificationCount(), { wrapper });

    await waitFor(() => expect(result.current.data).toBe(5));
  });

  test('useMarkNotificationAsRead memperbarui cache list dan unread count', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/notifications`, () =>
        HttpResponse.json({
          items: [makeNotificationDto()],
          pagination: { limit: 20, hasMore: false, nextCursor: null }
        })
      ),
      http.get(`${baseUrl}/api/v1/notifications/unread-count`, () =>
        HttpResponse.json({ unreadCount: 1 })
      ),
      http.patch(`${baseUrl}/api/v1/notifications/:notificationId/read`, ({ params }) =>
        HttpResponse.json({
          notification: makeNotificationDto({
            id: String(params.notificationId),
            readAt: '2026-11-11T11:00:00.000Z'
          })
        })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    const list = renderHook(() => useNotifications(), { wrapper });
    const unread = renderHook(() => useUnreadNotificationCount(), { wrapper });

    await waitFor(() => expect(list.result.current.isSuccess).toBe(true));
    await waitFor(() => expect(unread.result.current.data).toBe(1));

    const mutation = renderHook(() => useMarkNotificationAsRead(), { wrapper });

    await act(async () => {
      await mutation.result.current.mutateAsync('dddddddd-dddd-4ddd-8ddd-dddddddddddd');
    });

    const key = notificationKeys.list({ limit: 20, readStatus: 'all' });
    const cached = queryClient.getQueryData<{
      pages: { items: AppNotification[] }[];
      pageParams: unknown[];
    }>(key);

    expect(cached?.pages[0]?.items[0]?.readAt).toBeInstanceOf(Date);
  });

  test('useMarkAllNotificationsAsRead mengosongkan unread count di cache', async () => {
    server.use(
      http.patch(`${baseUrl}/api/v1/notifications/read-all`, () =>
        HttpResponse.json({ updated: 3 })
      ),
      http.get(`${baseUrl}/api/v1/notifications`, () =>
        HttpResponse.json({
          items: [],
          pagination: { limit: 20, hasMore: false, nextCursor: null }
        })
      ),
      http.get(`${baseUrl}/api/v1/notifications/unread-count`, () =>
        HttpResponse.json({ unreadCount: 0 })
      )
    );

    const { wrapper, queryClient } = createWrapper();
    queryClient.setQueryData(notificationKeys.unreadCount(), 3);

    const mutation = renderHook(() => useMarkAllNotificationsAsRead(), { wrapper });

    await act(async () => {
      await mutation.result.current.mutateAsync();
    });

    expect(queryClient.getQueryData(notificationKeys.unreadCount())).toBe(0);
  });

  test('preferensi notifikasi dapat dibaca dan diubah', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/notifications/preferences`, () =>
        HttpResponse.json({ preferences: { inAppEnabled: true, emailEnabled: false } })
      ),
      http.patch(`${baseUrl}/api/v1/notifications/preferences`, async ({ request }) => {
        const body = (await request.json()) as { emailEnabled: boolean };
        return HttpResponse.json({
          preferences: { inAppEnabled: true, emailEnabled: body.emailEnabled }
        });
      })
    );

    const { wrapper, queryClient } = createWrapper();
    const query = renderHook(() => useNotificationPreferences(), { wrapper });

    await waitFor(() =>
      expect(query.result.current.data).toEqual({
        inAppEnabled: true,
        emailEnabled: false
      })
    );

    const mutation = renderHook(() => useUpdateNotificationPreferences(), { wrapper });

    await act(async () => {
      const updated = await mutation.result.current.mutateAsync(true);
      expect(updated.emailEnabled).toBe(true);
    });

    await waitFor(() =>
      expect(queryClient.getQueryData(notificationKeys.preferences())).toEqual({
        inAppEnabled: true,
        emailEnabled: true
      })
    );
  });

  test('useNotificationFeed hanya mengambil notifikasi yang belum dibaca', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/notifications`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('readStatus')).toBe('unread');
        expect(url.searchParams.get('limit')).toBe('20');

        return HttpResponse.json({
          items: [makeNotificationDto()],
          pagination: { limit: 20, hasMore: false, nextCursor: null }
        });
      })
    );

    const { wrapper } = createWrapper();
    const { result } = renderHook(() => useNotificationFeed(), { wrapper });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  test('useBrowserNotifications meminta izin dan menampilkan notifikasi sekali', async () => {
    vi.stubGlobal('Notification', FakeNotification);

    const { result } = renderHook(() => useBrowserNotifications());

    expect(result.current.isSupported).toBe(true);
    expect(result.current.permission).toBe('granted');

    await act(async () => {
      expect(await result.current.requestPermission()).toBe('granted');
    });

    expect(result.current.showNotification({ id: 'notif-1', title: 'Judul', body: 'Isi' })).toBe(
      true
    );
    expect(result.current.showNotification({ id: 'notif-1', title: 'Judul', body: 'Isi' })).toBe(
      false
    );
    expect(FakeNotification.instances).toHaveLength(1);
    expect(FakeNotification.instances[0]?.options?.tag).toBe('notif-1');
  });

  test('useBrowserNotifications melaporkan unsupported tanpa Notification API', () => {
    Reflect.deleteProperty(window, 'Notification');

    expect(readBrowserNotificationPermission()).toBe('unsupported');

    const { result } = renderHook(() => useBrowserNotifications());

    expect(result.current.isSupported).toBe(false);
    expect(result.current.permission).toBe('unsupported');
    expect(result.current.showNotification({ id: 'x', title: 'x', body: 'x' })).toBe(false);
  });

  test('useNotificationUpdates menjadikan polling pertama baseline lalu menampilkan toast', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/notifications`, () =>
        HttpResponse.json({
          items: [],
          pagination: { limit: 20, hasMore: false, nextCursor: null }
        })
      )
    );

    const { wrapper, queryClient } = createToastWrapper();
    renderHook(() => useNotificationUpdates(), { wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryState(notificationKeys.feed())?.status).toBe('success')
    );

    expect(document.body.textContent).not.toContain('Tenggat mendekat');

    act(() => {
      queryClient.setQueryData(notificationKeys.feed(), {
        items: [appNotification()],
        pagination: { limit: 20, hasMore: false, nextCursor: null }
      });
    });

    await waitFor(() => expect(document.body.textContent).toContain('Tenggat mendekat'));
  });

  test('useNotificationUpdates memakai browser notification saat tab tersembunyi', async () => {
    vi.stubGlobal('Notification', FakeNotification);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

    server.use(
      http.get(`${baseUrl}/api/v1/notifications`, () =>
        HttpResponse.json({
          items: [],
          pagination: { limit: 20, hasMore: false, nextCursor: null }
        })
      )
    );

    const { wrapper, queryClient } = createToastWrapper();
    renderHook(() => useNotificationUpdates(), { wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryState(notificationKeys.feed())?.status).toBe('success')
    );

    act(() => {
      queryClient.setQueryData(notificationKeys.feed(), {
        items: [appNotification()],
        pagination: { limit: 20, hasMore: false, nextCursor: null }
      });
    });

    await waitFor(() => expect(FakeNotification.instances).toHaveLength(1));
    expect(document.body.textContent).not.toContain('Tenggat mendekat');
  });
});
