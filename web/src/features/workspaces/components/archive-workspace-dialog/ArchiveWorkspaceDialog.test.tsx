import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import type { Workspace } from '../../models/workspace.model';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { ArchiveWorkspaceDialog } from './ArchiveWorkspaceDialog';

const mockWorkspace: Workspace = {
  id: 'ws-archive-1',
  name: 'Workspace Untuk Arsip',
  description: null,
  role: 'owner',
  createdAt: new Date('2026-11-07T10:00:00.000Z'),
  updatedAt: new Date('2026-11-07T10:00:00.000Z'),
  archivedAt: null,
  mark: 'W'
};

describe('ArchiveWorkspaceDialog', () => {
  const baseUrl = 'http://localhost:4000';

  test('menampilkan konfirmasi dengan nama workspace', () => {
    renderWithProviders(
      <ArchiveWorkspaceDialog open={true} workspace={mockWorkspace} onClose={vi.fn()} />
    );

    expect(screen.getByRole('dialog', { name: 'Arsipkan Workspace' })).toBeInTheDocument();
    expect(screen.getByText('Workspace Untuk Arsip')).toBeInTheDocument();
  });

  test('menolak akses jika bukan owner', () => {
    const memberWorkspace: Workspace = {
      ...mockWorkspace,
      role: 'member'
    };

    renderWithProviders(
      <ArchiveWorkspaceDialog open={true} workspace={memberWorkspace} onClose={vi.fn()} />
    );

    expect(
      screen.getByText(/Hanya pemilik \(owner\) yang memiliki hak untuk mengarsipkan/i)
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ya, Arsipkan' })).not.toBeInTheDocument();
  });

  test('berhasil mengarsipkan workspace dan memanggil onSuccess', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/ws-archive-1/archive`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-archive-1',
            archivedAt: '2026-11-07T15:00:00.000Z'
          }
        });
      })
    );

    renderWithProviders(
      <ArchiveWorkspaceDialog
        open={true}
        workspace={mockWorkspace}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    const archiveBtn = screen.getByRole('button', { name: 'Ya, Arsipkan' });
    await user.click(archiveBtn);

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  test('menampilkan error jika backend mengembalikan kesalahan', async () => {
    const user = userEvent.setup();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/ws-archive-1/archive`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'WORKSPACE_PERMISSION_DENIED',
              message: 'Tidak berhak mengarsipkan.',
              requestId: 'req-err'
            }
          },
          { status: 403 }
        );
      })
    );

    renderWithProviders(
      <ArchiveWorkspaceDialog open={true} workspace={mockWorkspace} onClose={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: 'Ya, Arsipkan' }));

    await waitFor(() => {
      expect(screen.getByText('Tidak berhak mengarsipkan.')).toBeInTheDocument();
    });
  });
});
