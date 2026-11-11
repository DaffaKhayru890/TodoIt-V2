import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import type { ReactNode } from 'react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AppRoutes } from '@/app/router/router';
import { ToastProvider } from '@/components/ui/toast/toast-provider';
import { makeNotificationDto } from '@/test/fixtures/notifications';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { notificationKeys } from '../api/notification.query-keys';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const notificationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

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

function mockNotifications() {
  server.use(
    http.get(`${baseUrl}/api/v1/notifications`, ({ request }) => {
      const readStatus = new URL(request.url).searchParams.get('readStatus');

      if (readStatus === 'read') {
        return HttpResponse.json({
          items: [],
          pagination: { limit: 20, hasMore: false, nextCursor: null }
        });
      }

      return HttpResponse.json({
        items: [makeNotificationDto({ id: notificationId })],
        pagination: { limit: 20, hasMore: false, nextCursor: null }
      });
    }),
    http.get(`${baseUrl}/api/v1/notifications/unread-count`, () =>
      HttpResponse.json({ unreadCount: 1 })
    ),
    http.patch(`${baseUrl}/api/v1/notifications/${notificationId}/read`, () =>
      HttpResponse.json({
        notification: makeNotificationDto({
          id: notificationId,
          readAt: '2026-11-11T11:00:00.000Z'
        })
      })
    ),
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () =>
      HttpResponse.json({
        todo: makeTodoDto({
          id: todoId,
          title: 'Tenggat backend',
          description: 'Selesaikan sebelum tenggat.'
        })
      })
    )
  );
}

function createTrackingWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false }
    }
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <ToastProvider>
          <MemoryRouter initialEntries={[`/workspace/${workspaceId}`]}>{children}</MemoryRouter>
        </ToastProvider>
      </QueryClientProvider>
    );
  }

  return { queryClient, Wrapper };
}

describe('Notification workflows', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    FakeNotification.instances = [];
    FakeNotification.permission = 'granted';
  });

  test('Workflow E — bell membuka notification center, menandai dibaca, lalu membuka tugas', async () => {
    const user = userEvent.setup();
    mockNotifications();

    renderWithProviders(<AppRoutes />, `/workspace/${workspaceId}`);

    await user.click(
      await screen.findByRole('button', { name: 'Buka notifikasi, 1 belum dibaca' })
    );

    const dialog = await screen.findByRole('dialog', { name: 'Notifikasi' });

    expect(
      await screen.findByText('Tenggat mendekat', { selector: '.notification-item__title' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Tandai dibaca' }));

    expect(await screen.findByText('Notifikasi ditandai sudah dibaca.')).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Buka tugas terkait/i }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tenggat backend' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Notifikasi' })).not.toBeInTheDocument();
  });

  test('Workflow F — notifikasi tenggat baru menjadi browser notification saat tab tersembunyi', async () => {
    vi.stubGlobal('Notification', FakeNotification);
    vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    mockNotifications();

    const { queryClient, Wrapper } = createTrackingWrapper();

    render(<AppRoutes />, { wrapper: Wrapper });

    await waitFor(() =>
      expect(queryClient.getQueryState(notificationKeys.feed())?.status).toBe('success')
    );

    act(() => {
      queryClient.setQueryData(notificationKeys.feed(), {
        items: [
          {
            id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
            type: 'todo_due_soon',
            title: 'Tenggat 30 menit lagi',
            body: 'Tugas backend akan jatuh tempo.',
            data: { workspaceId, todoId },
            readAt: null,
            createdAt: new Date('2026-11-11T09:30:00.000Z')
          }
        ],
        pagination: { limit: 20, hasMore: false, nextCursor: null }
      });
    });

    await waitFor(() => expect(FakeNotification.instances).toHaveLength(1));
    expect(FakeNotification.instances[0]?.title).toBe('Tenggat 30 menit lagi');
    expect(FakeNotification.instances[0]?.options?.body).toBe('Tugas backend akan jatuh tempo.');
    expect(document.body.textContent).not.toContain('Tenggat 30 menit lagi');
  });
});
