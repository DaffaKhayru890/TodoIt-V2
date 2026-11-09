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
  })
];
