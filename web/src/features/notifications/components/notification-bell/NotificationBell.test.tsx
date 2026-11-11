import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import { makeNotificationDto } from '@/test/fixtures/notifications';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import type { AppNotification } from '../../models/notification.model';
import { NotificationBadge } from '../notification-badge/NotificationBadge';
import { NotificationBell } from '../notification-bell/NotificationBell';
import { NotificationItem } from '../notification-item/NotificationItem';
import { NotificationList } from '../notification-list/NotificationList';

const baseUrl = 'http://localhost:4000';
const notificationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function appNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: notificationId,
    type: 'todo_due_soon',
    title: 'Tenggat mendekat',
    body: 'Tugas segera jatuh tempo.',
    data: { workspaceId, todoId },
    readAt: null,
    createdAt: new Date(2026, 10, 11, 9, 30, 0),
    ...overrides
  };
}

describe('NotificationBadge & NotificationBell', () => {
  test('badge tidak dirender untuk count nol dan dibatasi 99+', () => {
    const { rerender } = renderWithProviders(<NotificationBadge count={0} />);
    expect(screen.queryByLabelText(/notifikasi belum dibaca/i)).not.toBeInTheDocument();

    rerender(<NotificationBadge count={5} />);
    expect(screen.getByLabelText('5 notifikasi belum dibaca')).toHaveTextContent('5');

    rerender(<NotificationBadge count={120} />);
    expect(screen.getByLabelText('120 notifikasi belum dibaca')).toHaveTextContent('99+');
  });

  test('bell menampilkan unread count dan memanggil onOpen', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    server.use(
      http.get(`${baseUrl}/api/v1/notifications/unread-count`, () =>
        HttpResponse.json({ unreadCount: 3 })
      )
    );

    renderWithProviders(<NotificationBell onOpen={onOpen} />);

    const button = await screen.findByRole('button', {
      name: 'Buka notifikasi, 3 belum dibaca'
    });
    expect(within(button).getByText('3')).toBeInTheDocument();

    await user.click(button);
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test('bell tanpa unread memakai label dasar', async () => {
    renderWithProviders(<NotificationBell onOpen={vi.fn()} />);

    expect(await screen.findByRole('button', { name: 'Buka notifikasi' })).toBeInTheDocument();
  });
});

describe('NotificationItem', () => {
  const now = new Date(2026, 10, 11, 12, 0, 0);

  test('menampilkan notifikasi belum dibaca dan aksi tandai dibaca', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();
    const onMarkRead = vi.fn();

    renderWithProviders(
      <NotificationItem
        notification={appNotification()}
        now={now}
        isMarkingRead={false}
        onOpen={onOpen}
        onMarkRead={onMarkRead}
      />
    );

    expect(screen.getByText('Belum dibaca')).toBeInTheDocument();
    expect(
      screen.getByText('Tenggat mendekat', { selector: '.notification-item__title' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Buka tugas terkait/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Tandai dibaca' }));
    expect(onMarkRead).toHaveBeenCalledTimes(1);
  });

  test('menampilkan status dibaca tanpa tombol tandai', () => {
    renderWithProviders(
      <NotificationItem
        notification={appNotification({ readAt: new Date(2026, 10, 11, 10, 0, 0) })}
        now={now}
        isMarkingRead={false}
        onOpen={vi.fn()}
        onMarkRead={vi.fn()}
      />
    );

    expect(screen.getByText('Dibaca')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Tandai dibaca' })).not.toBeInTheDocument();
  });

  test('menampilkan status marking dan target yang tidak tersedia', () => {
    renderWithProviders(
      <NotificationItem
        notification={appNotification({ data: {} })}
        now={now}
        isMarkingRead
        onOpen={vi.fn()}
        onMarkRead={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Menandai…' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: /Tugas terkait tidak tersedia/i })
    ).toBeInTheDocument();
  });
});

describe('NotificationList', () => {
  test('mengelompokkan notifikasi berdasarkan hari', () => {
    const now = new Date(2026, 10, 11, 12, 0, 0);

    renderWithProviders(
      <NotificationList
        notifications={[
          appNotification({
            id: 'a',
            title: 'Hari ini',
            createdAt: new Date(2026, 10, 11, 9, 0, 0)
          }),
          appNotification({
            id: 'b',
            title: 'Kemarin',
            createdAt: new Date(2026, 10, 10, 9, 0, 0)
          }),
          appNotification({
            id: 'c',
            title: 'Lebih lama',
            createdAt: new Date(2026, 10, 1, 9, 0, 0)
          })
        ]}
        now={now}
        markReadPendingId={null}
        onOpen={vi.fn()}
        onMarkRead={vi.fn()}
      />
    );

    expect(screen.getByRole('heading', { name: 'Hari ini' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kemarin' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Sebelumnya' })).toBeInTheDocument();
    expect(
      screen.getByText('Hari ini', { selector: '.notification-item__title' })
    ).toBeInTheDocument();
  });
});

describe('Notification fixture sanity', () => {
  test('fixture default belum dibaca dan memiliki target todo', () => {
    expect(makeNotificationDto().readAt).toBeNull();
    expect(makeNotificationDto().data).toMatchObject({ workspaceId, todoId });
  });
});
