import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, test } from 'vitest';
import { makeTagDto, tagFixtures } from '@/test/fixtures/tags';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { TagsPage } from './TagsPage';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/workspace/:workspaceId/tags" element={<TagsPage />} />
    </Routes>,
    `/workspace/${workspaceId}/tags`
  );
}

function mockRole(role: 'owner' | 'admin' | 'member') {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}`, () =>
      HttpResponse.json({
        workspace: {
          id: workspaceId,
          name: 'Proyek Alpha',
          description: null,
          role,
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
          archivedAt: null
        }
      })
    )
  );
}

function mockTags(items = tagFixtures) {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () =>
      HttpResponse.json({
        items,
        pagination: { limit: 100, hasMore: false, nextCursor: null }
      })
    )
  );
}

describe('TagsPage', () => {
  test('menampilkan skeleton saat data dimuat', () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, async () => {
        return new Promise(() => {});
      })
    );

    renderPage();
    expect(screen.getByLabelText('Memuat tags')).toBeInTheDocument();
  });

  test('menampilkan daftar tag dan aksi pengelolaan untuk owner', async () => {
    mockRole('owner');
    mockTags();

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Tags' })).toBeInTheDocument();
    expect(screen.getByText(/Proyek Alpha/)).toBeInTheDocument();

    const list = screen.getByRole('list', { name: 'Daftar tag' });
    expect(within(list).getByText('backend')).toBeInTheDocument();
    expect(within(list).getByText('design')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buat Tag' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ubah tag backend' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hapus tag backend' })).toBeInTheDocument();
  });

  test('menyembunyikan aksi pengelolaan untuk member', async () => {
    mockRole('member');
    mockTags();

    renderPage();

    expect(
      await screen.findByText('Hanya owner/admin dapat mengelola tag')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buat Tag' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ubah tag backend' })).not.toBeInTheDocument();
  });

  test('menampilkan empty state ketika belum ada tag', async () => {
    mockRole('owner');
    mockTags([]);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Belum ada tag' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buat tag pertama' })).toBeInTheDocument();
  });

  test('menampilkan error dan mencoba ulang', async () => {
    mockRole('owner');
    let calls = 0;

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () => {
        calls += 1;
        return HttpResponse.json(
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Terjadi kesalahan server.',
              requestId: 'req-500'
            }
          },
          { status: 500 }
        );
      })
    );

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Gagal memuat tag' }, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByText('Terjadi kesalahan server.')).toBeInTheDocument();

    const before = calls;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Coba lagi' }));
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });

  test('membuat tag melalui dialog dan menampilkan feedback', async () => {
    const user = userEvent.setup();
    mockRole('owner');
    mockTags([]);

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () =>
        HttpResponse.json({ tag: makeTagDto({ name: 'Frontend' }) }, { status: 201 })
      )
    );

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Buat tag pertama' }));
    await user.type(screen.getByLabelText('Nama Tag'), 'Frontend');
    await user.click(screen.getByRole('button', { name: 'Buat Tag' }));

    expect(
      await screen.findByText('Tag #Frontend berhasil dibuat.')
    ).toBeInTheDocument();
  });

  test('menghapus tag melalui dialog konfirmasi dan menampilkan feedback', async () => {
    const user = userEvent.setup();
    mockRole('owner');
    mockTags();

    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/tags/${tagFixtures[0]!.id}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Hapus tag backend' }));
    expect(screen.getByRole('dialog', { name: 'Hapus Tag' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hapus Tag' }));

    expect(await screen.findByText('Tag berhasil dihapus.')).toBeInTheDocument();
  });
});
