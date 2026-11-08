import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import type { Workspace } from '../../models/workspace.model';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { EditWorkspaceDialog } from './EditWorkspaceDialog';

const mockWorkspace: Workspace = {
  id: 'ws-test-1',
  name: 'Workspace Lama',
  description: 'Keterangan lama',
  role: 'owner',
  createdAt: new Date('2026-11-07T10:00:00.000Z'),
  updatedAt: new Date('2026-11-07T10:00:00.000Z'),
  archivedAt: null,
  mark: 'W'
};

describe('EditWorkspaceDialog', () => {
  const baseUrl = 'http://localhost:4000';

  test('memuat nilai awal dari data workspace', () => {
    renderWithProviders(
      <EditWorkspaceDialog open={true} workspace={mockWorkspace} onClose={vi.fn()} />
    );

    expect(screen.getByRole('dialog', { name: 'Ubah Workspace' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama Workspace/i)).toHaveValue('Workspace Lama');
    expect(screen.getByLabelText(/Deskripsi/i)).toHaveValue('Keterangan lama');
  });

  test('menolak akses jika bukan owner', () => {
    const memberWorkspace: Workspace = {
      ...mockWorkspace,
      role: 'member'
    };

    renderWithProviders(
      <EditWorkspaceDialog open={true} workspace={memberWorkspace} onClose={vi.fn()} />
    );

    expect(screen.getByText(/Hanya pemilik \(owner\) yang memiliki hak/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Simpan Perubahan' })).not.toBeInTheDocument();
  });

  test('berhasil mengubah workspace', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/ws-test-1`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-test-1',
            name: 'Workspace Baru',
            description: 'Keterangan baru',
            role: 'owner',
            createdAt: '2026-11-07T10:00:00.000Z',
            updatedAt: '2026-11-07T12:00:00.000Z',
            archivedAt: null
          }
        });
      })
    );

    renderWithProviders(
      <EditWorkspaceDialog
        open={true}
        workspace={mockWorkspace}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    const nameInput = screen.getByLabelText(/Nama Workspace/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Workspace Baru');

    const submitBtn = screen.getByRole('button', { name: 'Simpan Perubahan' });
    expect(submitBtn).toBeEnabled();
    await user.click(submitBtn);

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Workspace Baru'
      })
    );
  });

  test('meminta konfirmasi ketika menutup form yang sudah diubah', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithProviders(
      <EditWorkspaceDialog open={true} workspace={mockWorkspace} onClose={handleClose} />
    );

    const nameInput = screen.getByLabelText(/Nama Workspace/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Draft Nama');

    await user.keyboard('{Escape}');
    expect(screen.getByTestId('discard-changes')).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Lanjutkan Mengedit' }));
    expect(screen.getByLabelText(/Nama Workspace/i)).toHaveValue('Draft Nama');

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Buang Perubahan' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('memetakan detail validasi backend ke field yang tepat', async () => {
    const user = userEvent.setup();

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/ws-test-1`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Permintaan tidak lolos validasi skema.',
              requestId: 'req-detail',
              details: [{ path: 'body.name', message: 'Nama ditolak backend.' }]
            }
          },
          { status: 422 }
        );
      })
    );

    renderWithProviders(
      <EditWorkspaceDialog open={true} workspace={mockWorkspace} onClose={vi.fn()} />
    );

    const nameInput = screen.getByLabelText(/Nama Workspace/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Nama Baru');

    await user.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    await waitFor(() => {
      expect(screen.getByText('Nama ditolak backend.')).toBeInTheDocument();
    });
  });

  test('menampilkan pesan error jika server menolak update', async () => {
    const user = userEvent.setup();

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/ws-test-1`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'WORKSPACE_PERMISSION_DENIED',
              message: 'Hanya owner yang boleh memperbarui workspace.',
              requestId: 'req-403'
            }
          },
          { status: 403 }
        );
      })
    );

    renderWithProviders(
      <EditWorkspaceDialog open={true} workspace={mockWorkspace} onClose={vi.fn()} />
    );

    const nameInput = screen.getByLabelText(/Nama Workspace/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Nama Lain');

    await user.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    await waitFor(() => {
      expect(screen.getByText('Hanya owner yang boleh memperbarui workspace.')).toBeInTheDocument();
    });
  });
});
