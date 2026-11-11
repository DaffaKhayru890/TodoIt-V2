import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test } from 'vitest';
import { AppRoutes } from '@/app/router/router';
import { makeLabelDto } from '@/test/fixtures/labels';
import { makeTagDto } from '@/test/fixtures/tags';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { SEARCH_RECENT_STORAGE_KEY } from '../models/search.model';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function findTodoOption(scope: HTMLElement): Promise<HTMLElement> {
  const options = await within(scope).findAllByRole('option');
  const option = options.find((candidate) =>
    candidate.textContent?.includes('Backend integration')
  );

  expect(option).toBeDefined();
  return option as HTMLElement;
}

function mockSearchBackend() {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces`, () =>
      HttpResponse.json({
        items: [
          {
            id: workspaceId,
            name: 'Personal',
            description: null,
            role: 'owner',
            createdAt: '2026-11-01T00:00:00.000Z'
          }
        ],
        pagination: { limit: 50, offset: 0, total: 1 }
      })
    ),
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, ({ request }) => {
      const hasQuery = new URL(request.url).searchParams.has('q');

      return HttpResponse.json({
        items: hasQuery
          ? [
              makeTodoDto({
                id: todoId,
                title: 'Backend integration',
                description: 'Selesaikan endpoint backend'
              })
            ]
          : [],
        pagination: { limit: hasQuery ? 8 : 30, hasMore: false, nextCursor: null }
      });
    }),
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () =>
      HttpResponse.json({
        items: [makeTagDto({ name: 'backend' })],
        pagination: { limit: 5, hasMore: false, nextCursor: null }
      })
    ),
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () =>
      HttpResponse.json({
        items: [makeLabelDto({ name: 'Backend layer' })],
        pagination: { limit: 5, hasMore: false, nextCursor: null }
      })
    ),
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () =>
      HttpResponse.json({
        todo: makeTodoDto({
          id: todoId,
          title: 'Backend integration',
          description: 'Selesaikan endpoint backend'
        })
      })
    )
  );
}

describe('Search workflows', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('Workflow A — Ctrl+K, cari lintas workspace, lalu buka hasil ke detail tugas', async () => {
    const user = userEvent.setup();
    mockSearchBackend();

    renderWithProviders(<AppRoutes />, `/workspace/${workspaceId}`);

    await screen.findByRole('heading', { level: 1, name: 'Personal' });
    await user.keyboard('{Control>}k{/Control}');

    const dialog = await screen.findByRole('dialog', { name: 'Cari di TodoIt' });
    const input = within(dialog).getByRole('combobox');

    await user.type(input, 'backend');

    await user.click(await findTodoOption(dialog));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Backend integration' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Cari di TodoIt' })).not.toBeInTheDocument();
  });

  test('Workflow B — riwayat pencarian tersimpan, dapat dipakai ulang, dan dibersihkan', async () => {
    const user = userEvent.setup();
    mockSearchBackend();

    renderWithProviders(<AppRoutes />, '/search');

    const input = await screen.findByRole('combobox');

    await user.type(input, 'backend');
    await user.keyboard('{Enter}');

    expect(JSON.parse(localStorage.getItem(SEARCH_RECENT_STORAGE_KEY) ?? '[]')).toEqual([
      'backend'
    ]);

    await user.click(screen.getByRole('button', { name: 'Hapus kata pencarian' }));

    const recentList = screen.getByRole('heading', { name: 'Pencarian terakhir' }).parentElement
      ?.parentElement;
    expect(recentList).not.toBeNull();
    await user.click(within(recentList as HTMLElement).getByRole('button', { name: 'backend' }));

    expect(screen.getByRole('combobox')).toHaveValue('backend');

    await user.click(screen.getByRole('button', { name: 'Hapus kata pencarian' }));
    await user.click(screen.getByRole('button', { name: 'Hapus semua' }));

    expect(screen.getByText(/Belum ada pencarian terakhir/i)).toBeInTheDocument();
  });
});
