import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { ApiError } from '@/core/errors/api-error';
import { makeLabelDto } from '@/test/fixtures/labels';
import { makeTagDto } from '@/test/fixtures/tags';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { createSearchApi } from './search.api';

const baseUrl = 'http://localhost:4000';
const workspaceOne = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Personal'
};
const workspaceTwo = {
  id: '22222222-2222-4222-8222-222222222222',
  name: 'Kerja tim'
};

function searchApi() {
  return createSearchApi();
}

function todoHandler(
  workspaceId: string,
  items: readonly ReturnType<typeof makeTodoDto>[],
  assertQuery = true
) {
  return http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, ({ request }) => {
    const url = new URL(request.url);

    if (assertQuery) {
      expect(url.searchParams.get('q')).toBeTruthy();
      expect(url.searchParams.get('limit')).toBe('8');
    }

    return HttpResponse.json({
      items,
      pagination: { limit: 8, hasMore: false, nextCursor: null }
    });
  });
}

function tagHandler(workspaceId: string, items: readonly ReturnType<typeof makeTagDto>[]) {
  return http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, ({ request }) => {
    expect(new URL(request.url).searchParams.get('limit')).toBe('5');

    return HttpResponse.json({
      items,
      pagination: { limit: 5, hasMore: false, nextCursor: null }
    });
  });
}

function labelHandler(workspaceId: string, items: readonly ReturnType<typeof makeLabelDto>[]) {
  return http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, ({ request }) => {
    expect(new URL(request.url).searchParams.get('limit')).toBe('5');

    return HttpResponse.json({
      items,
      pagination: { limit: 5, hasMore: false, nextCursor: null }
    });
  });
}

describe('searchApi', () => {
  test('melakukan fan-out ke todo, tag, dan label serta mengelompokkan hasil', async () => {
    server.use(
      todoHandler(workspaceOne.id, [
        makeTodoDto({ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', title: 'Backend integration' })
      ]),
      tagHandler(workspaceOne.id, [makeTagDto({ name: 'backend' })]),
      labelHandler(workspaceOne.id, [makeLabelDto({ name: 'Backend layer' })]),
      todoHandler(workspaceTwo.id, []),
      tagHandler(workspaceTwo.id, []),
      labelHandler(workspaceTwo.id, [])
    );

    const result = await searchApi().search({
      query: 'backend',
      workspaces: [workspaceOne, workspaceTwo]
    });

    expect(result.total).toBe(3);
    expect(result.failedWorkspaces).toBe(0);
    expect(result.groups.map((group) => [group.kind, group.items.length])).toEqual([
      ['todo', 1],
      ['tag', 1],
      ['label', 1]
    ]);
    expect(result.groups[0]?.items[0]).toMatchObject({
      workspaceId: workspaceOne.id,
      workspaceName: 'Personal'
    });
    expect(result.groups[0]?.items[0]?.href).toContain('/todos/');
  });

  test('mengembalikan hasil kosong ketika tidak ada data yang cocok', async () => {
    const result = await searchApi().search({
      query: 'tidak-ada',
      workspaces: [workspaceOne]
    });

    expect(result).toMatchObject({ total: 0, groups: [], failedWorkspaces: 0 });
  });

  test('tidak mengirim request ketika daftar workspace kosong', async () => {
    const result = await searchApi().search({ query: 'backend', workspaces: [] });

    expect(result).toMatchObject({ total: 0, groups: [], failedWorkspaces: 0 });
  });

  test('meneruskan error 403 ketika seluruh workspace gagal', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceOne.id}/todos`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'WORKSPACE_PERMISSION_DENIED',
              message: 'Akses ditolak.',
              requestId: 'req-403'
            }
          },
          { status: 403 }
        )
      )
    );

    await expect(
      searchApi().search({ query: 'backend', workspaces: [workspaceOne] })
    ).rejects.toMatchObject({ status: 403 });
  });

  test('menghitung workspace yang gagal tetapi mempertahankan hasil lain', async () => {
    server.use(
      todoHandler(workspaceOne.id, [makeTodoDto({ title: 'Backend satu' })]),
      tagHandler(workspaceOne.id, []),
      labelHandler(workspaceOne.id, []),
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceTwo.id}/todos`, () =>
        HttpResponse.json(
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Server bermasalah.',
              requestId: 'req-500'
            }
          },
          { status: 500 }
        )
      )
    );

    const result = await searchApi().search({
      query: 'backend',
      workspaces: [workspaceOne, workspaceTwo]
    });

    expect(result.total).toBe(1);
    expect(result.failedWorkspaces).toBe(1);
  });

  test('membuang duplikat berdasarkan ID backend', async () => {
    const duplicated = makeTodoDto({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      workspaceId: workspaceOne.id,
      title: 'Backend integration'
    });

    server.use(
      todoHandler(workspaceOne.id, [duplicated]),
      tagHandler(workspaceOne.id, []),
      labelHandler(workspaceOne.id, []),
      todoHandler(workspaceTwo.id, [{ ...duplicated, workspaceId: workspaceTwo.id }]),
      tagHandler(workspaceTwo.id, []),
      labelHandler(workspaceTwo.id, [])
    );

    const result = await searchApi().search({
      query: 'backend',
      workspaces: [workspaceOne, workspaceTwo]
    });

    expect(result.total).toBe(1);
  });

  test('menolak response yang tidak sesuai kontrak', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceOne.id}/todos`, () =>
        HttpResponse.json({ items: 'bukan array' })
      )
    );

    await expect(
      searchApi().search({ query: 'backend', workspaces: [workspaceOne] })
    ).rejects.toBeInstanceOf(ApiError);
  });

  test('menghormati AbortSignal yang sudah dibatalkan', async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      searchApi().search({
        query: 'backend',
        workspaces: [workspaceOne],
        signal: controller.signal
      })
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
