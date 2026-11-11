import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { useLocation } from 'react-router';
import { describe, expect, test, vi } from 'vitest';
import { makeNotificationDto } from '@/test/fixtures/notifications';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { NotificationCenter } from './NotificationCenter';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function LocationProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderCenter(onClose = vi.fn()) {
  return renderWithProviders(
    <>
      <NotificationCenter open onClose={onClose} />
      <LocationProbe />
    </>,
    '/inbox'
  );
}

function mockList(items: readonly ReturnType<typeof makeNotificationDto>[], hasMore = false) {
  server.use(
    http.get(`${baseUrl}/api/v1/notifications`, () =>
      HttpResponse.json({
        items,
        pagination: { limit: 20, hasMore, nextCursor: hasMore ? 'cursor-2' : null }
      })
    )
  );
}

describe('NotificationCenter', () => {
  test('tidak merender dialog ketika tertutup', () => {
    renderWithProviders(<NotificationCenter open={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('menampilkan empty state ketika tidak ada notifikasi', async () => {
    renderCenter();

    expect(await screen.findByText('Semua sudah tertangani!')).toBeInTheDocument();
    expect(screen.getByText('Tidak ada notifikasi baru untuk saat ini.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tandai semua dibaca' })).toBeDisabled();
  });

  test('menampilkan daftar notifikasi dan jumlah belum dibaca', async () => {
    mockList([
      makeNotificationDto(),
      makeNotificationDto({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        type: 'reminder_due',
        title: 'Pengingat tugas',
        readAt: '2026-11-11T08:00:00.000Z'
      })
    ]);
    server.use(
      http.get(`${baseUrl}/api/v1/notifications/unread-count`, () =>
        HttpResponse.json({ unreadCount: 1 })
      )
    );

    renderCenter();

    expect(
      await screen.findByText('Tenggat mendekat', { selector: '.notification-item__title' })
    ).toBeInTheDocument();
    expect(screen.getByText('Pengingat tugas')).toBeInTheDocument();
    expect(
      screen.getByText('Dibaca', { selector: '.notification-item__read-label' })
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tandai semua dibaca' })).toBeEnabled();
  });

  test('filter mengirim readStatus ke backend dan mempertahankan feedback', async () => {
    const user = userEvent.setup();
    const readStatuses: (string | null)[] = [];

    server.use(
      http.get(`${baseUrl}/api/v1/notifications`, ({ request }) => {
        const readStatus = new URL(request.url).searchParams.get('readStatus');
        readStatuses.push(readStatus);

        return HttpResponse.json({
          items: readStatus === 'unread' ? [makeNotificationDto()] : [],
          pagination: { limit: 20, hasMore: false, nextCursor: null }
        });
      })
    );

    renderCenter();

    await screen.findByText('Semua sudah tertangani!');
    await user.click(screen.getByRole('button', { name: 'Belum dibaca' }));

    expect(
      await screen.findByText('Tenggat mendekat', { selector: '.notification-item__title' })
    ).toBeInTheDocument();
    expect(readStatuses).toContain('unread');
    expect(screen.getByRole('button', { name: 'Belum dibaca' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  test('menandai satu notifikasi sebagai dibaca dan menampilkan status', async () => {
    const user = userEvent.setup();
    mockList([makeNotificationDto()]);
    server.use(
      http.get(`${baseUrl}/api/v1/notifications/unread-count`, () =>
        HttpResponse.json({ unreadCount: 1 })
      ),
      http.patch(`${baseUrl}/api/v1/notifications/${makeNotificationDto().id}/read`, () =>
        HttpResponse.json({
          notification: makeNotificationDto({ readAt: '2026-11-11T11:00:00.000Z' })
        })
      )
    );

    renderCenter();

    await user.click(await screen.findByRole('button', { name: 'Tandai dibaca' }));

    expect(await screen.findByText('Notifikasi ditandai sudah dibaca.')).toBeInTheDocument();
  });

  test('menandai semua notifikasi sebagai dibaca', async () => {
    const user = userEvent.setup();
    mockList([makeNotificationDto()]);
    server.use(
      http.get(`${baseUrl}/api/v1/notifications/unread-count`, () =>
        HttpResponse.json({ unreadCount: 2 })
      ),
      http.patch(`${baseUrl}/api/v1/notifications/read-all`, () =>
        HttpResponse.json({ updated: 2 })
      )
    );

    renderCenter();

    await user.click(await screen.findByRole('button', { name: 'Tandai semua dibaca' }));

    expect(await screen.findByText('2 notifikasi ditandai sudah dibaca.')).toBeInTheDocument();
  });

  test('membuka notifikasi menandai dibaca, menutup panel, dan menavigasi ke todo', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    mockList([makeNotificationDto()]);
    server.use(
      http.get(`${baseUrl}/api/v1/notifications/unread-count`, () =>
        HttpResponse.json({ unreadCount: 1 })
      ),
      http.patch(`${baseUrl}/api/v1/notifications/${makeNotificationDto().id}/read`, () =>
        HttpResponse.json({
          notification: makeNotificationDto({ readAt: '2026-11-11T11:00:00.000Z' })
        })
      )
    );

    renderCenter(onClose);

    await user.click(await screen.findByRole('button', { name: /Buka tugas terkait/i }));

    await waitFor(() =>
      expect(screen.getByTestId('location')).toHaveTextContent(
        `/workspace/${workspaceId}/todos/${todoId}`
      )
    );
    expect(onClose).toHaveBeenCalled();
  });

  test('notifikasi tanpa target menampilkan status dan tidak menutup panel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    mockList([makeNotificationDto({ data: {} })]);
    server.use(
      http.get(`${baseUrl}/api/v1/notifications/unread-count`, () =>
        HttpResponse.json({ unreadCount: 1 })
      )
    );

    renderCenter(onClose);

    await user.click(await screen.findByRole('button', { name: /Tugas terkait tidak tersedia/i }));

    expect(
      await screen.findByText('Notifikasi tidak memiliki tugas terkait yang dapat dibuka.')
    ).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  test('menampilkan error awal dengan tombol coba lagi', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/notifications`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Server bermasalah.', requestId: 'req-1' } },
          { status: 500 }
        )
      )
    );

    renderCenter();

    expect(await screen.findByText('Server bermasalah.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });

  test('memuat halaman notifikasi berikutnya melalui tombol', async () => {
    const user = userEvent.setup();
    let callCount = 0;

    server.use(
      http.get(`${baseUrl}/api/v1/notifications`, ({ request }) => {
        const cursor = new URL(request.url).searchParams.get('cursor');
        callCount += 1;

        return HttpResponse.json({
          items: [
            makeNotificationDto({
              id: cursor ? 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee' : makeNotificationDto().id,
              title: cursor ? 'Halaman kedua' : 'Halaman pertama'
            })
          ],
          pagination: {
            limit: 20,
            hasMore: cursor === null,
            nextCursor: cursor === null ? 'cursor-2' : null
          }
        });
      })
    );

    renderCenter();

    expect(await screen.findByText('Halaman pertama')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Muat lebih banyak' }));

    expect(await screen.findByText('Halaman kedua')).toBeInTheDocument();
    expect(screen.getByText('Halaman pertama')).toBeInTheDocument();
    expect(callCount).toBe(2);
  });

  test('tombol preferensi navigasi ke settings dan menutup panel', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderCenter(onClose);

    await screen.findByText('Semua sudah tertangani!');
    await user.click(screen.getByRole('button', { name: 'Preferensi notifikasi' }));

    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/settings');
  });
});
