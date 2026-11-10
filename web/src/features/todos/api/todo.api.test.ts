import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { ApiError } from '@/core/errors/api-error';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { todoApi } from './todo.api';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('todoApi', () => {
  test('getByWorkspace mengirim limit/cursor dan memetakan hasil', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('limit')).toBe('100');
        expect(url.searchParams.get('cursor')).toBe('cursor-1');

        return HttpResponse.json({
          items: [makeTodoDto()],
          pagination: { limit: 100, hasMore: true, nextCursor: 'cursor-2' }
        });
      })
    );

    const result = await todoApi.getByWorkspace(workspaceId, {
      limit: 100,
      cursor: 'cursor-1'
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.title).toBe('Tugas contoh');
    expect(result.pagination.nextCursor).toBe('cursor-2');
  });

  test('getByWorkspace tanpa params tidak menambahkan query string', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, ({ request }) => {
        expect(new URL(request.url).search).toBe('');
        return HttpResponse.json({
          items: [],
          pagination: { limit: 20, hasMore: false, nextCursor: null }
        });
      })
    );

    const result = await todoApi.getByWorkspace(workspaceId);
    expect(result.items).toEqual([]);
  });

  test('getById mengambil detail todo', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        return HttpResponse.json({ todo: makeTodoDto() });
      })
    );

    const todo = await todoApi.getById(workspaceId, todoId);
    expect(todo.id).toBe(todoId);
    expect(todo.createdAt).toBeInstanceOf(Date);
  });

  test('create mengirim payload title/description yang sudah dinormalisasi', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, async ({ request }) => {
        const body = (await request.json()) as { title: string; description: string | null };
        expect(body).toEqual({ title: 'Tugas baru', description: 'Deskripsi baru' });

        return HttpResponse.json(
          {
            todo: makeTodoDto({
              id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
              title: body.title,
              description: body.description
            })
          },
          { status: 201 }
        );
      })
    );

    const created = await todoApi.create(workspaceId, {
      title: '  Tugas baru  ',
      description: '  Deskripsi baru  '
    });

    expect(created.title).toBe('Tugas baru');
  });

  test('update hanya mengirim field yang berubah', async () => {
    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`,
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body).toEqual({ title: 'Judul Baru' });
          return HttpResponse.json({ todo: makeTodoDto({ title: 'Judul Baru' }) });
        }
      )
    );

    const updated = await todoApi.update(workspaceId, todoId, { title: 'Judul Baru' });
    expect(updated.title).toBe('Judul Baru');
  });

  test('complete memanggil endpoint complete', async () => {
    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/complete`, () => {
        return HttpResponse.json({
          todo: makeTodoDto({
            status: 'completed',
            completedAt: '2026-11-07T12:00:00.000Z'
          })
        });
      })
    );

    const completed = await todoApi.complete(workspaceId, todoId);
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBeInstanceOf(Date);
  });

  test('remove menerima respons 204 tanpa body', async () => {
    server.use(
      http.delete(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        return new HttpResponse(null, { status: 204 });
      })
    );

    await expect(todoApi.remove(workspaceId, todoId)).resolves.toBeUndefined();
  });

  test('melempar ApiError 404 ketika todo tidak ditemukan', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'TODO_NOT_FOUND',
              message: 'Todo tidak ditemukan.',
              requestId: 'req-404'
            }
          },
          { status: 404 }
        );
      })
    );

    await expect(todoApi.getById(workspaceId, todoId)).rejects.toMatchObject({
      status: 404,
      code: 'TODO_NOT_FOUND'
    });
  });

  test('mempertahankan detail validasi 422', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Permintaan tidak lolos validasi skema.',
              requestId: 'req-422',
              details: [{ path: 'body.title', message: 'Judul wajib diisi.' }]
            }
          },
          { status: 422 }
        );
      })
    );

    await expect(
      todoApi.create(workspaceId, { title: '', description: null })
    ).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      details: [{ path: 'body.title', message: 'Judul wajib diisi.' }]
    });
  });

  test('melempar ApiError 403 ketika role tidak berwenang', async () => {
    server.use(
      http.delete(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'WORKSPACE_PERMISSION_DENIED',
              message: 'Role Anda tidak memiliki izin.',
              requestId: 'req-403'
            }
          },
          { status: 403 }
        );
      })
    );

    await expect(todoApi.remove(workspaceId, todoId)).rejects.toMatchObject({
      status: 403,
      code: 'WORKSPACE_PERMISSION_DENIED'
    });
  });

  test('melempar ApiError 401 ketika pengguna belum terautentikasi', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'UNAUTHORIZED',
              message: 'Autentikasi diperlukan.',
              requestId: 'req-401'
            }
          },
          { status: 401 }
        );
      })
    );

    await expect(todoApi.getByWorkspace(workspaceId)).rejects.toMatchObject({
      status: 401,
      code: 'UNAUTHORIZED'
    });
  });

  test('mendeteksi respons todo yang tidak valid', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        return HttpResponse.json({ todo: { id: 'rusak' } });
      })
    );

    await expect(todoApi.getById(workspaceId, todoId)).rejects.toMatchObject({
      code: 'INVALID_TODO_RESPONSE'
    });
  });

  test('mendeteksi daftar todo yang tidak valid', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () => {
        return HttpResponse.json({ items: 'rusak', pagination: {} });
      })
    );

    await expect(todoApi.getByWorkspace(workspaceId)).rejects.toBeInstanceOf(ApiError);
  });

  test('menerjemahkan kegagalan jaringan menjadi NETWORK_ERROR', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () => {
        return HttpResponse.error();
      })
    );

    await expect(todoApi.getByWorkspace(workspaceId)).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR'
    });
  });
});

describe('todoApi Phase 5', () => {
  test('getByWorkspace mengirim seluruh filter yang didukung backend', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, ({ request }) => {
        const url = new URL(request.url);
        const params = url.searchParams;

        expect(params.get('status')).toBe('completed');
        expect(params.get('priority')).toBe('urgent');
        expect(params.get('dueFrom')).toBe('2026-11-01T00:00:00.000Z');
        expect(params.get('dueTo')).toBe('2026-11-30T23:59:59.999Z');
        expect(params.get('createdFrom')).toBe('2026-10-01T00:00:00.000Z');
        expect(params.get('createdTo')).toBe('2026-10-31T23:59:59.999Z');
        expect(params.get('q')).toBe('laporan');
        expect(params.getAll('tagIds')).toEqual(['tag-1', 'tag-2']);
        expect(params.get('labelId')).toBe('label-1');

        return HttpResponse.json({
          items: [makeTodoDto()],
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        });
      })
    );

    await todoApi.getByWorkspace(workspaceId, {
      status: 'completed',
      priority: 'urgent',
      dueFrom: new Date('2026-11-01T00:00:00.000Z'),
      dueTo: new Date('2026-11-30T23:59:59.999Z'),
      createdFrom: new Date('2026-10-01T00:00:00.000Z'),
      createdTo: new Date('2026-10-31T23:59:59.999Z'),
      q: 'laporan',
      tagIds: ['tag-1', 'tag-2'],
      labelId: 'label-1'
    });
  });

  test('getToday mengirim timezone, includeCompleted, pagination, dan metadata filter', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/today`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.get('timezone')).toBe('Asia/Jakarta');
        expect(params.get('includeCompleted')).toBe('true');
        expect(params.get('limit')).toBe('100');
        expect(params.get('cursor')).toBe('cursor-1');
        expect(params.getAll('tagIds')).toEqual(['tag-1']);
        expect(params.get('labelId')).toBe('label-1');

        return HttpResponse.json({
          items: [makeTodoDto()],
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        });
      })
    );

    const result = await todoApi.getToday(workspaceId, {
      timezone: 'Asia/Jakarta',
      includeCompleted: true,
      limit: 100,
      cursor: 'cursor-1',
      tagIds: ['tag-1'],
      labelId: 'label-1'
    });

    expect(result.items).toHaveLength(1);
  });

  test('getUpcoming mengirim days dan filter metadata', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/upcoming`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.get('timezone')).toBe('Asia/Jakarta');
        expect(params.get('days')).toBe('30');
        expect(params.getAll('tagIds')).toEqual(['tag-1', 'tag-2']);
        expect(params.get('labelId')).toBe('label-1');

        return HttpResponse.json({
          items: [],
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        });
      })
    );

    await todoApi.getUpcoming(workspaceId, {
      timezone: 'Asia/Jakarta',
      days: 30,
      tagIds: ['tag-1', 'tag-2'],
      labelId: 'label-1'
    });
  });

  test('getOverdue mengirim timezone dan filter metadata tanpa days', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/overdue`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        expect(params.get('timezone')).toBe('Asia/Jakarta');
        expect(params.get('days')).toBeNull();
        expect(params.getAll('tagIds')).toEqual(['tag-1']);
        expect(params.get('labelId')).toBe('label-1');

        return HttpResponse.json({
          items: [],
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        });
      })
    );

    await todoApi.getOverdue(workspaceId, {
      timezone: 'Asia/Jakarta',
      tagIds: ['tag-1'],
      labelId: 'label-1'
    });
  });

  test('create mengirim priority dan dueAt sebagai ISO instant', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;

        expect(body).toEqual({
          title: 'Rilis Phase 5',
          description: null,
          priority: 'high',
          dueAt: '2026-11-12T02:00:00.000Z'
        });

        return HttpResponse.json(
          {
            todo: makeTodoDto({
              title: 'Rilis Phase 5',
              priority: 'high',
              dueAt: '2026-11-12T02:00:00.000Z'
            })
          },
          { status: 201 }
        );
      })
    );

    const created = await todoApi.create(workspaceId, {
      title: 'Rilis Phase 5',
      description: null,
      priority: 'high',
      dueAt: new Date('2026-11-12T02:00:00.000Z')
    });

    expect(created.priority).toBe('high');
    expect(created.dueAt).toEqual(new Date('2026-11-12T02:00:00.000Z'));
  });

  test('create mempertahankan dueAt null untuk todo tanpa tenggat', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, async ({ request }) => {
        const body = (await request.json()) as Record<string, unknown>;
        expect(body).toEqual({ title: 'Tanpa tenggat', description: null, dueAt: null });
        return HttpResponse.json(
          { todo: makeTodoDto({ title: 'Tanpa tenggat', dueAt: null }) },
          { status: 201 }
        );
      })
    );

    await todoApi.create(workspaceId, {
      title: 'Tanpa tenggat',
      description: null,
      dueAt: null
    });
  });

  test('update mengirim priority, dueAt, dan labelId nullable', async () => {
    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`,
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body).toEqual({
            priority: 'urgent',
            dueAt: null,
            labelId: null
          });
          return HttpResponse.json({
            todo: makeTodoDto({ priority: 'urgent', dueAt: null, label: null })
          });
        }
      )
    );

    const updated = await todoApi.update(workspaceId, todoId, {
      priority: 'urgent',
      dueAt: null,
      labelId: null
    });

    expect(updated.priority).toBe('urgent');
    expect(updated.dueAt).toBeNull();
    expect(updated.label).toBeNull();
  });
});
