import { http, HttpResponse } from 'msw';
import { workspaceFixtures } from '@/test/fixtures/workspaces';

const baseUrl = 'http://localhost:4000';

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
  })
];
