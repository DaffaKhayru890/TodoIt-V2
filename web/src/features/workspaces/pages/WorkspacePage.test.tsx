import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, test } from 'vitest';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { WorkspacePage } from './WorkspacePage';

describe('WorkspacePage', () => {
  const baseUrl = 'http://localhost:4000';

  function renderWorkspacePage(path = '/workspace/ws-page-1') {
    return renderWithProviders(
      <Routes>
        <Route path="/workspace/:workspaceId" element={<WorkspacePage />} />
        <Route path="/inbox" element={<div>Inbox Landing</div>} />
      </Routes>,
      path
    );
  }

  test('menampilkan skeleton saat loading', () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/ws-loading`, async () => {
        return new Promise(() => {});
      })
    );

    renderWorkspacePage('/workspace/ws-loading');
    expect(screen.getByLabelText('Memuat workspace')).toBeInTheDocument();
  });

  test('menampilkan detail workspace ketika sukses', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/ws-page-1`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-page-1',
            name: 'Workspace Proyek',
            description: 'Keterangan proyek',
            role: 'owner',
            createdAt: '2026-11-01T00:00:00.000Z',
            updatedAt: '2026-11-01T00:00:00.000Z',
            archivedAt: null
          }
        });
      })
    );

    renderWorkspacePage('/workspace/ws-page-1');

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { level: 1, name: 'Workspace Proyek' })
      ).toBeInTheDocument();
    });

    expect(screen.getByText('Your workspace is ready!')).toBeInTheDocument();
  });

  test('menampilkan pesan workspace tidak ditemukan ketika 404', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/ws-notfound`, () => {
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

    renderWorkspacePage('/workspace/ws-notfound');

    await waitFor(() => {
      expect(screen.getByText('Workspace tidak ditemukan')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Kembali ke Inbox' })).toBeInTheDocument();
  });

  test('menampilkan akses ditolak ketika 403', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/ws-denied`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'WORKSPACE_PERMISSION_DENIED',
              message: 'Akses ditolak.',
              requestId: 'req-403'
            }
          },
          { status: 403 }
        );
      })
    );

    renderWorkspacePage('/workspace/ws-denied');

    await waitFor(() => {
      expect(screen.getByText('Akses ditolak')).toBeInTheDocument();
    });
  });

  test('menyembunyikan aksi ubah dan arsipkan untuk anggota non-owner', async () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/ws-member`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-member',
            name: 'Workspace Bersama',
            description: null,
            role: 'member',
            createdAt: '2026-11-01T00:00:00.000Z',
            updatedAt: '2026-11-01T00:00:00.000Z',
            archivedAt: null
          }
        });
      })
    );

    renderWorkspacePage('/workspace/ws-member');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Workspace Bersama' })
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ubah' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Arsipkan' })).not.toBeInTheDocument();
  });

  test('dapat membuka dialog ubah workspace', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/ws-page-1`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-page-1',
            name: 'Workspace Proyek',
            description: null,
            role: 'owner',
            createdAt: '2026-11-01T00:00:00.000Z',
            updatedAt: '2026-11-01T00:00:00.000Z',
            archivedAt: null
          }
        });
      })
    );

    renderWorkspacePage('/workspace/ws-page-1');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Ubah' })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Ubah' }));

    expect(screen.getByRole('dialog', { name: 'Ubah Workspace' })).toBeInTheDocument();
  });
});
