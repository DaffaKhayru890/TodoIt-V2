import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, test } from 'vitest';
import { labelFixtures, makeLabelDto } from '@/test/fixtures/labels';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { LabelsPage } from './LabelsPage';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/workspace/:workspaceId/labels" element={<LabelsPage />} />
    </Routes>,
    `/workspace/${workspaceId}/labels`
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

function mockLabels(items = labelFixtures) {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () =>
      HttpResponse.json({
        items,
        pagination: { limit: 100, hasMore: false, nextCursor: null }
      })
    )
  );
}

describe('LabelsPage', () => {
  test('menampilkan skeleton saat data dimuat', () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, async () => {
        return new Promise(() => {});
      })
    );

    renderPage();
    expect(screen.getByLabelText('Memuat labels')).toBeInTheDocument();
  });

  test('menampilkan daftar label dengan deskripsi dan aksi untuk owner', async () => {
    mockRole('owner');
    mockLabels();

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Labels' })).toBeInTheDocument();

    const list = screen.getByRole('list', { name: 'Daftar label' });
    expect(within(list).getByText('Bug')).toBeInTheDocument();
    expect(within(list).getByText('Feature')).toBeInTheDocument();
    expect(within(list).getByText('Pekerjaan fitur baru')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buat Label' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ubah label Bug' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Hapus label Bug' })).toBeInTheDocument();
  });

  test('menyembunyikan aksi pengelolaan untuk member', async () => {
    mockRole('member');
    mockLabels();

    renderPage();

    expect(await screen.findByText('Hanya owner/admin dapat mengelola label')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Buat Label' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ubah label Bug' })).not.toBeInTheDocument();
  });

  test('menampilkan empty state ketika belum ada label', async () => {
    mockRole('owner');
    mockLabels([]);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Belum ada label' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buat label pertama' })).toBeInTheDocument();
  });

  test('menampilkan error dan mencoba ulang', async () => {
    mockRole('owner');
    let calls = 0;

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () => {
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
      await screen.findByRole('heading', { name: 'Gagal memuat label' }, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByText('Terjadi kesalahan server.')).toBeInTheDocument();

    const before = calls;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Coba lagi' }));
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });

  test('membuat label melalui dialog dan menampilkan feedback', async () => {
    const user = userEvent.setup();
    mockRole('owner');
    mockLabels([]);

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () =>
        HttpResponse.json({ label: makeLabelDto({ name: 'Frontend' }) }, { status: 201 })
      )
    );

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Buat label pertama' }));
    await user.type(screen.getByLabelText('Nama Label'), 'Frontend');
    await user.click(
      within(screen.getByRole('dialog', { name: 'Buat Label Baru' })).getByRole('button', {
        name: 'Buat Label'
      })
    );

    expect(await screen.findByText('Label Frontend berhasil dibuat.')).toBeInTheDocument();
  });

  test('menghapus label melalui dialog konfirmasi dan menampilkan feedback', async () => {
    const user = userEvent.setup();
    mockRole('owner');
    mockLabels();

    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/labels/${labelFixtures[0]!.id}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Hapus label Bug' }));
    expect(screen.getByRole('dialog', { name: 'Hapus Label' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hapus Label' }));

    expect(await screen.findByText('Label berhasil dihapus.')).toBeInTheDocument();
  });
});
