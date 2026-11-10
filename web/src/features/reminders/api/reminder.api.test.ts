import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { ApiError } from '@/core/errors/api-error';
import { makeReminderDto } from '@/test/fixtures/reminders';
import { server } from '@/test/mocks/server';
import { reminderApi } from './reminder.api';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const reminderId = 'c1111111-1111-4111-8111-111111111111';

describe('reminderApi', () => {
  test('list mengirim status/limit/cursor dan memetakan hasil', async () => {
    server.use(
      http.get(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders`,
        ({ request }) => {
          const url = new URL(request.url);
          expect(url.searchParams.get('status')).toBe('scheduled');
          expect(url.searchParams.get('limit')).toBe('100');
          expect(url.searchParams.get('cursor')).toBe('cursor-1');

          return HttpResponse.json({
            items: [makeReminderDto()],
            pagination: { limit: 100, hasMore: false, nextCursor: null }
          });
        }
      )
    );

    const result = await reminderApi.list(workspaceId, todoId, {
      status: 'scheduled',
      limit: 100,
      cursor: 'cursor-1'
    });

    expect(result.items[0]?.offsetMinutes).toBe(15);
  });

  test('list tanpa params tidak menambahkan query string', async () => {
    server.use(
      http.get(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders`,
        ({ request }) => {
          expect(new URL(request.url).search).toBe('');
          return HttpResponse.json({
            items: [],
            pagination: { limit: 100, hasMore: false, nextCursor: null }
          });
        }
      )
    );

    await expect(reminderApi.list(workspaceId, todoId)).resolves.toMatchObject({ items: [] });
  });

  test('get mengambil satu reminder', async () => {
    server.use(
      http.get(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders/${reminderId}`,
        () => HttpResponse.json({ reminder: makeReminderDto() })
      )
    );

    await expect(reminderApi.get(workspaceId, todoId, reminderId)).resolves.toMatchObject({
      id: reminderId
    });
  });

  test('create mengirim trigger before_due dan offset', async () => {
    server.use(
      http.post(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders`,
        async ({ request }) => {
          expect(await request.json()).toEqual({
            triggerType: 'before_due',
            offsetMinutes: 30
          });
          return HttpResponse.json(
            { reminder: makeReminderDto({ offsetMinutes: 30 }) },
            { status: 201 }
          );
        }
      )
    );

    const reminder = await reminderApi.create(workspaceId, todoId, {
      triggerType: 'before_due',
      offsetMinutes: 30
    });
    expect(reminder.offsetMinutes).toBe(30);
  });

  test('create mengirim remindAt sebagai ISO instant', async () => {
    server.use(
      http.post(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders`,
        async ({ request }) => {
          expect(await request.json()).toEqual({
            triggerType: 'absolute',
            remindAt: '2026-11-12T09:00:00.000Z'
          });
          return HttpResponse.json({
            reminder: makeReminderDto({
              triggerType: 'absolute',
              remindAt: '2026-11-12T09:00:00.000Z',
              offsetMinutes: null
            })
          });
        }
      )
    );

    await reminderApi.create(workspaceId, todoId, {
      triggerType: 'absolute',
      remindAt: new Date('2026-11-12T09:00:00.000Z')
    });
  });

  test('update mengirim PATCH offsetMinutes', async () => {
    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders/${reminderId}`,
        async ({ request }) => {
          expect(await request.json()).toEqual({ offsetMinutes: 60 });
          return HttpResponse.json({ reminder: makeReminderDto({ offsetMinutes: 60 }) });
        }
      )
    );

    await expect(
      reminderApi.update(workspaceId, todoId, reminderId, { offsetMinutes: 60 })
    ).resolves.toMatchObject({ offsetMinutes: 60 });
  });

  test('cancel mengirim DELETE tanpa body', async () => {
    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders/${reminderId}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    await expect(reminderApi.cancel(workspaceId, todoId, reminderId)).resolves.toBeUndefined();
  });

  test('melempar ApiError ketika response reminder rusak', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders`, () =>
        HttpResponse.json({ items: [{ id: 'rusak' }], pagination: {} })
      )
    );

    await expect(reminderApi.list(workspaceId, todoId)).rejects.toBeInstanceOf(ApiError);
  });

  test('menerjemahkan kegagalan jaringan', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders`, () =>
        HttpResponse.error()
      )
    );

    await expect(reminderApi.list(workspaceId, todoId)).rejects.toMatchObject({
      code: 'NETWORK_ERROR'
    });
  });
});
