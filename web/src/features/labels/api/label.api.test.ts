import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { ApiError } from '@/core/errors/api-error';
import { makeLabelDto } from '@/test/fixtures/labels';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { LABEL_LIST_PAGE_SIZE, labelApi } from './label.api';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const labelId = 'b1111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('labelApi', () => {
  test('getAll mengirim limit/cursor/q dan memetakan hasil', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('limit')).toBe(String(LABEL_LIST_PAGE_SIZE));
        expect(url.searchParams.get('cursor')).toBe('cursor-1');
        expect(url.searchParams.get('q')).toBe('bug');

        return HttpResponse.json({
          items: [makeLabelDto()],
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        });
      })
    );

    const result = await labelApi.getAll(workspaceId, {
      limit: LABEL_LIST_PAGE_SIZE,
      cursor: 'cursor-1',
      q: 'bug'
    });

    expect(result.items[0]?.name).toBe('Bug');
  });

  test('getById mengambil satu label', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels/${labelId}`, () =>
        HttpResponse.json({ label: makeLabelDto() })
      )
    );

    await expect(labelApi.getById(workspaceId, labelId)).resolves.toMatchObject({ id: labelId });
  });

  test('create menormalkan payload termasuk warna uppercase', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, async ({ request }) => {
        expect(await request.json()).toEqual({
          name: 'Bug',
          color: '#E74C3C',
          description: 'Masalah produksi'
        });

        return HttpResponse.json({ label: makeLabelDto() }, { status: 201 });
      })
    );

    await labelApi.create(workspaceId, {
      name: ' Bug ',
      color: '#e74c3c',
      description: '  Masalah produksi  '
    });
  });

  test('update hanya mengirim field yang diberikan', async () => {
    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/labels/${labelId}`,
        async ({ request }) => {
          expect(await request.json()).toEqual({ description: null });
          return HttpResponse.json({ label: makeLabelDto({ description: null }) });
        }
      )
    );

    await labelApi.update(workspaceId, labelId, { description: null });
  });

  test('remove menerima 204', async () => {
    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/labels/${labelId}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    await expect(labelApi.remove(workspaceId, labelId)).resolves.toBeUndefined();
  });

  test('assignTodoLabel mengirim PUT labelId dan memetakan todo', async () => {
    server.use(
      http.put(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/label`,
        async ({ request }) => {
          expect(await request.json()).toEqual({ labelId });
          return HttpResponse.json({
            todo: makeTodoDto({
              label: { id: labelId, name: 'Bug', color: '#E74C3C' }
            })
          });
        }
      )
    );

    const todo = await labelApi.assignTodoLabel(workspaceId, todoId, labelId);
    expect(todo.label?.id).toBe(labelId);
  });

  test('clearTodoLabel mengirim DELETE dan memetakan todo tanpa label', async () => {
    server.use(
      http.delete(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/label`, () =>
        HttpResponse.json({ todo: makeTodoDto({ label: null }) })
      )
    );

    const todo = await labelApi.clearTodoLabel(workspaceId, todoId);
    expect(todo.label).toBeNull();
  });

  test('melempar ApiError ketika response label rusak', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () =>
        HttpResponse.json({ items: 'rusak', pagination: {} })
      )
    );

    await expect(labelApi.getAll(workspaceId)).rejects.toBeInstanceOf(ApiError);
  });

  test('menerjemahkan kegagalan jaringan', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () => HttpResponse.error())
    );

    await expect(labelApi.getAll(workspaceId)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
