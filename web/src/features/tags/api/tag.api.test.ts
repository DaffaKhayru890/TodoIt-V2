import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { ApiError } from '@/core/errors/api-error';
import { makeTagDto } from '@/test/fixtures/tags';
import { server } from '@/test/mocks/server';
import { tagApi, TAG_LIST_PAGE_SIZE } from './tag.api';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const tagId = 'a1111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

describe('tagApi', () => {
  test('getAll mengirim limit/cursor/q dan memetakan hasil', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, ({ request }) => {
        const url = new URL(request.url);
        expect(url.searchParams.get('limit')).toBe(String(TAG_LIST_PAGE_SIZE));
        expect(url.searchParams.get('cursor')).toBe('cursor-1');
        expect(url.searchParams.get('q')).toBe('back');

        return HttpResponse.json({
          items: [makeTagDto()],
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        });
      })
    );

    const result = await tagApi.getAll(workspaceId, {
      limit: TAG_LIST_PAGE_SIZE,
      cursor: 'cursor-1',
      q: 'back'
    });

    expect(result.items[0]?.name).toBe('backend');
  });

  test('getById mengambil satu tag', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags/${tagId}`, () =>
        HttpResponse.json({ tag: makeTagDto() })
      )
    );

    await expect(tagApi.getById(workspaceId, tagId)).resolves.toMatchObject({ id: tagId });
  });

  test('create mengirim nama yang sudah dinormalisasi', async () => {
    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, async ({ request }) => {
        expect(await request.json()).toEqual({ name: 'Frontend' });
        return HttpResponse.json({ tag: makeTagDto({ name: 'Frontend' }) }, { status: 201 });
      })
    );

    const created = await tagApi.create(workspaceId, { name: '  Frontend  ' });
    expect(created.name).toBe('Frontend');
  });

  test('update mengirim PATCH nama', async () => {
    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags/${tagId}`, async ({ request }) => {
        expect(await request.json()).toEqual({ name: 'Backend API' });
        return HttpResponse.json({ tag: makeTagDto({ name: 'Backend API' }) });
      })
    );

    await expect(
      tagApi.update(workspaceId, tagId, { name: ' Backend API ' })
    ).resolves.toMatchObject({ name: 'Backend API' });
  });

  test('remove menerima 204', async () => {
    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/tags/${tagId}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    await expect(tagApi.remove(workspaceId, tagId)).resolves.toBeUndefined();
  });

  test('replaceTodoTags mengirim PUT seluruh tagIds', async () => {
    server.use(
      http.put(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/tags`,
        async ({ request }) => {
          expect(await request.json()).toEqual({ tagIds: [tagId] });
          return HttpResponse.json({ tags: [{ id: tagId, name: 'backend' }] });
        }
      )
    );

    await expect(
      tagApi.replaceTodoTags(workspaceId, todoId, [tagId])
    ).resolves.toEqual([{ id: tagId, name: 'backend' }]);
  });

  test('addTodoTag dan removeTodoTag memakai endpoint per tag', async () => {
    server.use(
      http.post(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/tags/${tagId}`,
        () => HttpResponse.json({ tags: [{ id: tagId, name: 'backend' }] })
      ),
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/tags/${tagId}`,
        () => HttpResponse.json({ tags: [] })
      )
    );

    await expect(tagApi.addTodoTag(workspaceId, todoId, tagId)).resolves.toHaveLength(1);
    await expect(tagApi.removeTodoTag(workspaceId, todoId, tagId)).resolves.toEqual([]);
  });

  test('melempar ApiError ketika response tag rusak', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () =>
        HttpResponse.json({ items: 'rusak', pagination: {} })
      )
    );

    await expect(tagApi.getAll(workspaceId)).rejects.toBeInstanceOf(ApiError);
  });

  test('menerjemahkan kegagalan jaringan', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () => HttpResponse.error())
    );

    await expect(tagApi.getAll(workspaceId)).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });
});
