import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { ApiError } from '@/core/errors/api-error';
import { server } from '@/test/mocks/server';
import { workspaceApi } from './workspace.api';

describe('workspaceApi', () => {
  const baseUrl = 'http://localhost:4000';

  test('getAll mengambil daftar workspace dan memetakan dengan benar', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('limit')).toBe('10');
        expect(url.searchParams.get('offset')).toBe('5');

        return HttpResponse.json({
          items: [
            {
              id: 'ws-1',
              name: 'Personal',
              description: 'Deskripsi saya',
              role: 'owner',
              createdAt: '2026-11-07T10:00:00.000Z'
            }
          ],
          pagination: { limit: 10, offset: 5, total: 1 }
        });
      })
    );

    const result = await workspaceApi.getAll({ limit: 10, offset: 5 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.name).toBe('Personal');
    expect(result.items[0]?.role).toBe('owner');
    expect(result.items[0]?.mark).toBe('P');
    expect(result.pagination.total).toBe(1);
  });

  test('getById mengambil detail workspace', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/ws-1`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-1',
            name: 'Workspace 1',
            description: null,
            role: 'owner',
            createdAt: '2026-11-07T10:00:00.000Z',
            updatedAt: '2026-11-07T11:00:00.000Z',
            archivedAt: null
          }
        });
      })
    );

    const ws = await workspaceApi.getById('ws-1');
    expect(ws.id).toBe('ws-1');
    expect(ws.name).toBe('Workspace 1');
    expect(ws.createdAt).toBeInstanceOf(Date);
  });

  test('create mengirim payload yang sesuai dan mengembalikan workspace baru', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces`, async ({ request }) => {
        const body = (await request.json()) as { name: string; description?: string };
        expect(body.name).toBe('Project Alpha');
        expect(body.description).toBe('Deskripsi proyek');

        return HttpResponse.json(
          {
            workspace: {
              id: 'ws-alpha',
              name: 'Project Alpha',
              description: 'Deskripsi proyek',
              role: 'owner',
              createdAt: '2026-11-07T10:00:00.000Z',
              updatedAt: '2026-11-07T10:00:00.000Z',
              archivedAt: null
            }
          },
          { status: 201 }
        );
      })
    );

    const created = await workspaceApi.create({
      name: 'Project Alpha',
      description: 'Deskripsi proyek'
    });

    expect(created.id).toBe('ws-alpha');
    expect(created.name).toBe('Project Alpha');
    expect(created.role).toBe('owner');
  });

  test('update mengirim payload perubahan dan mengembalikan workspace terbarui', async () => {
    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/ws-alpha`, async ({ request }) => {
        const body = (await request.json()) as { name?: string };
        expect(body.name).toBe('Project Alpha Rev');

        return HttpResponse.json({
          workspace: {
            id: 'ws-alpha',
            name: 'Project Alpha Rev',
            description: 'Deskripsi proyek',
            role: 'owner',
            createdAt: '2026-11-07T10:00:00.000Z',
            updatedAt: '2026-11-07T12:00:00.000Z',
            archivedAt: null
          }
        });
      })
    );

    const updated = await workspaceApi.update('ws-alpha', { name: 'Project Alpha Rev' });
    expect(updated.name).toBe('Project Alpha Rev');
  });

  test('archive memanggil endpoint archive dan mengembalikan hasil pengarsipan', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/ws-alpha/archive`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-alpha',
            archivedAt: '2026-11-07T15:00:00.000Z'
          }
        });
      })
    );

    const result = await workspaceApi.archive('ws-alpha');
    expect(result.id).toBe('ws-alpha');
    expect(result.archivedAt).toBeInstanceOf(Date);
  });

  test('melempar ApiError ketika workspace tidak ditemukan (404)', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/not-found`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'WORKSPACE_NOT_FOUND',
              message: 'Workspace tidak ditemukan.',
              requestId: 'req-404'
            }
          },
          { status: 404 }
        );
      })
    );

    await expect(workspaceApi.getById('not-found')).rejects.toThrow(ApiError);
    await expect(workspaceApi.getById('not-found')).rejects.toMatchObject({
      status: 404,
      code: 'WORKSPACE_NOT_FOUND'
    });
  });

  test('mempertahankan detail error validasi 422', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Permintaan tidak lolos validasi skema.',
              requestId: 'req-422',
              details: [{ path: 'body.name', message: 'Nama wajib diisi.' }]
            }
          },
          { status: 422 }
        );
      })
    );

    await expect(workspaceApi.create({ name: '' })).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      details: [{ path: 'body.name', message: 'Nama wajib diisi.' }]
    });
  });

  test('melempar ApiError ketika pengguna tidak berhak (403)', async () => {
    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/ws-forbidden`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'WORKSPACE_PERMISSION_DENIED',
              message: 'Anda tidak memiliki hak akses.',
              requestId: 'req-403'
            }
          },
          { status: 403 }
        );
      })
    );

    await expect(workspaceApi.update('ws-forbidden', { name: 'Gagal' })).rejects.toMatchObject({
      status: 403,
      code: 'WORKSPACE_PERMISSION_DENIED'
    });
  });
});
