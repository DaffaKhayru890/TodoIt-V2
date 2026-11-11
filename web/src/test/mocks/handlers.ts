import { http, HttpResponse } from 'msw';
import { workspaceFixtures } from '@/test/fixtures/workspaces';

const baseUrl = 'http://localhost:4000';

const defaultWorkspace = workspaceFixtures[0]!;

export const defaultHandlers = [
  http.get(`${baseUrl}/api/v1/workspaces`, () => {
    return HttpResponse.json({
      items: workspaceFixtures.map((fixture) => ({
        id: fixture.id,
        name: fixture.name,
        description: null,
        role: 'owner',
        createdAt: '2026-11-01T00:00:00.000Z'
      })),
      pagination: {
        limit: 20,
        offset: 0,
        total: workspaceFixtures.length
      }
    });
  }),

  http.get(`${baseUrl}/api/v1/workspaces/:workspaceId`, ({ params }) => {
    const fixture =
      workspaceFixtures.find((item) => item.id === params.workspaceId) ?? defaultWorkspace;

    return HttpResponse.json({
      workspace: {
        id: fixture.id,
        name: fixture.name,
        description: null,
        role: 'owner',
        createdAt: '2026-11-01T00:00:00.000Z',
        updatedAt: '2026-11-01T00:00:00.000Z',
        archivedAt: null
      }
    });
  }),

  // Workspace detail secara default tidak memiliki todo. Test yang membutuhkan
  // data todo mendaftarkan handler lebih spesifik lewat server.use().
  http.get(`${baseUrl}/api/v1/workspaces/:workspaceId/todos`, () => {
    return HttpResponse.json({
      items: [],
      pagination: {
        limit: 100,
        hasMore: false,
        nextCursor: null
      }
    });
  }),

  http.get(`${baseUrl}/api/v1/workspaces/:workspaceId/todos/today`, () => {
    return HttpResponse.json({
      items: [],
      pagination: { limit: 100, hasMore: false, nextCursor: null }
    });
  }),

  http.get(`${baseUrl}/api/v1/workspaces/:workspaceId/todos/upcoming`, () => {
    return HttpResponse.json({
      items: [],
      pagination: { limit: 100, hasMore: false, nextCursor: null }
    });
  }),

  http.get(`${baseUrl}/api/v1/workspaces/:workspaceId/todos/overdue`, () => {
    return HttpResponse.json({
      items: [],
      pagination: { limit: 100, hasMore: false, nextCursor: null }
    });
  }),

  http.get(`${baseUrl}/api/v1/workspaces/:workspaceId/tags`, () => {
    return HttpResponse.json({
      items: [],
      pagination: { limit: 100, hasMore: false, nextCursor: null }
    });
  }),

  http.get(`${baseUrl}/api/v1/workspaces/:workspaceId/labels`, () => {
    return HttpResponse.json({
      items: [],
      pagination: { limit: 100, hasMore: false, nextCursor: null }
    });
  }),

  http.get(`${baseUrl}/api/v1/workspaces/:workspaceId/todos/:todoId/reminders`, () => {
    return HttpResponse.json({
      items: [],
      pagination: { limit: 100, hasMore: false, nextCursor: null }
    });
  }),

  // Notification default kosong: tidak ada notifikasi palsu di production,
  // dan test yang membutuhkan data mendaftarkan handler sendiri.
  http.get(`${baseUrl}/api/v1/notifications`, () => {
    return HttpResponse.json({
      items: [],
      pagination: { limit: 20, hasMore: false, nextCursor: null }
    });
  }),

  http.get(`${baseUrl}/api/v1/notifications/unread-count`, () => {
    return HttpResponse.json({ unreadCount: 0 });
  }),

  http.get(`${baseUrl}/api/v1/notifications/preferences`, () => {
    return HttpResponse.json({
      preferences: { inAppEnabled: true, emailEnabled: false }
    });
  }),

  http.patch(`${baseUrl}/api/v1/notifications/preferences`, async ({ request }) => {
    const body = (await request.json()) as { emailEnabled: boolean };

    return HttpResponse.json({
      preferences: { inAppEnabled: true, emailEnabled: body.emailEnabled }
    });
  }),

  http.patch(`${baseUrl}/api/v1/notifications/read-all`, () => {
    return HttpResponse.json({ updated: 0 });
  }),

  http.patch(`${baseUrl}/api/v1/notifications/:notificationId/read`, ({ params }) => {
    return HttpResponse.json({
      notification: {
        id: params.notificationId,
        type: 'todo_due_soon',
        title: 'Tenggat mendekat',
        body: 'Tugas contoh akan jatuh tempo.',
        data: {},
        readAt: '2026-11-11T10:00:00.000Z',
        createdAt: '2026-11-11T09:30:00.000Z'
      }
    });
  })
];
