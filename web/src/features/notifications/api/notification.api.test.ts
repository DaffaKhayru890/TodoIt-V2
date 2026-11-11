import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { ApiError } from '@/core/errors/api-error';
import { makeNotificationDto } from '@/test/fixtures/notifications';
import { server } from '@/test/mocks/server';
import { notificationApi } from './notification.api';

const baseUrl = 'http://localhost:4000';
const notificationId = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';

describe('notificationApi', () => {
  test('getList mengirim limit, cursor, readStatus, dan type lalu memetakan hasil', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/notifications`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('limit')).toBe('20');
        expect(url.searchParams.get('cursor')).toBe('cursor-1');
        expect(url.searchParams.get('readStatus')).toBe('unread');
        expect(url.searchParams.get('type')).toBe('todo_due_soon');

        return HttpResponse.json({
          items: [makeNotificationDto()],
          pagination: { limit: 20, hasMore: true, nextCursor: 'cursor-2' }
        });
      })
    );

    const result = await notificationApi.getList({
      limit: 20,
      cursor: 'cursor-1',
      readStatus: 'unread',
      type: 'todo_due_soon'
    });

    expect(result.items[0]?.title).toBe('Tenggat mendekat');
    expect(result.items[0]?.readAt).toBeNull();
    expect(result.pagination).toEqual({ limit: 20, hasMore: true, nextCursor: 'cursor-2' });
  });

  test('getList tidak mengirim readStatus=all secara eksplisit', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/notifications`, ({ request }) => {
        expect(new URL(request.url).searchParams.get('readStatus')).toBeNull();
        return HttpResponse.json({
          items: [],
          pagination: { limit: 20, hasMore: false, nextCursor: null }
        });
      })
    );

    await expect(notificationApi.getList({ readStatus: 'all' })).resolves.toMatchObject({
      items: []
    });
  });

  test('getUnreadCount membaca endpoint terpisah', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/notifications/unread-count`, () =>
        HttpResponse.json({ unreadCount: 7 })
      )
    );

    await expect(notificationApi.getUnreadCount()).resolves.toBe(7);
  });

  test('markRead memanggil endpoint read dan memetakan notifikasi', async () => {
    server.use(
      http.patch(`${baseUrl}/api/v1/notifications/${notificationId}/read`, () =>
        HttpResponse.json({
          notification: makeNotificationDto({
            readAt: '2026-11-11T11:00:00.000Z'
          })
        })
      )
    );

    const result = await notificationApi.markRead(notificationId);

    expect(result.id).toBe(notificationId);
    expect(result.readAt).toBeInstanceOf(Date);
  });

  test('markAllRead mengembalikan jumlah yang diperbarui', async () => {
    server.use(
      http.patch(`${baseUrl}/api/v1/notifications/read-all`, () =>
        HttpResponse.json({ updated: 4 })
      )
    );

    await expect(notificationApi.markAllRead()).resolves.toBe(4);
  });

  test('preferences dapat dibaca dan diubah', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/notifications/preferences`, () =>
        HttpResponse.json({ preferences: { inAppEnabled: true, emailEnabled: false } })
      ),
      http.patch(`${baseUrl}/api/v1/notifications/preferences`, async ({ request }) => {
        const body = (await request.json()) as { emailEnabled: boolean };
        expect(body).toEqual({ emailEnabled: true });

        return HttpResponse.json({
          preferences: { inAppEnabled: true, emailEnabled: true }
        });
      })
    );

    await expect(notificationApi.getPreferences()).resolves.toEqual({
      inAppEnabled: true,
      emailEnabled: false
    });
    await expect(notificationApi.updatePreferences({ emailEnabled: true })).resolves.toEqual({
      inAppEnabled: true,
      emailEnabled: true
    });
  });

  test('meneruskan error unauthorized', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/notifications`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Sesi berakhir.',
              requestId: 'req-401'
            }
          },
          { status: 401 }
        )
      )
    );

    await expect(notificationApi.getList()).rejects.toMatchObject({ status: 401 });
  });

  test('meneruskan error forbidden', async () => {
    server.use(
      http.patch(`${baseUrl}/api/v1/notifications/${notificationId}/read`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'FORBIDDEN',
              message: 'Tidak diizinkan.',
              requestId: 'req-403'
            }
          },
          { status: 403 }
        )
      )
    );

    await expect(notificationApi.markRead(notificationId)).rejects.toMatchObject({ status: 403 });
  });

  test('menolak response notifikasi yang invalid', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/notifications`, () =>
        HttpResponse.json({ items: [{ id: 'x' }], pagination: {} })
      )
    );

    await expect(notificationApi.getList()).rejects.toBeInstanceOf(ApiError);
  });

  test('meneruskan kegagalan jaringan', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/notifications/unread-count`, () => HttpResponse.error())
    );

    await expect(notificationApi.getUnreadCount()).rejects.toBeInstanceOf(ApiError);
  });
});
