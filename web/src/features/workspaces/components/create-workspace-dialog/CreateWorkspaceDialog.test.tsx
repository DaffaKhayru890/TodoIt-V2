import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { CreateWorkspaceDialog } from './CreateWorkspaceDialog';

describe('CreateWorkspaceDialog', () => {
  const baseUrl = 'http://localhost:4000';

  test('merender form ketika open bernilai true', () => {
    renderWithProviders(<CreateWorkspaceDialog open={true} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Buat Workspace Baru' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Nama Workspace/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buat Workspace' })).toBeInTheDocument();
  });

  test('tidak merender dialog ketika open bernilai false', () => {
    renderWithProviders(<CreateWorkspaceDialog open={false} onClose={vi.fn()} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('menampilkan validasi saat nama kosong', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CreateWorkspaceDialog open={true} onClose={vi.fn()} />);

    const submitBtn = screen.getByRole('button', { name: 'Buat Workspace' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('Nama workspace wajib diisi')).toBeInTheDocument();
    });
  });

  test('berhasil membuat workspace dan memanggil onSuccess serta onClose', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces`, () => {
        return HttpResponse.json(
          {
            workspace: {
              id: 'ws-new-123',
              name: 'Workspace Sukses',
              description: 'Catatan kerja',
              role: 'owner',
              createdAt: '2026-11-07T10:00:00.000Z',
              updatedAt: '2026-11-07T10:00:00.000Z',
              archivedAt: null
            }
          },
          { status: 201 }
        );
      })
    );

    renderWithProviders(
      <CreateWorkspaceDialog open={true} onClose={handleClose} onSuccess={handleSuccess} />
    );

    const nameInput = screen.getByLabelText(/Nama Workspace/i);
    await user.type(nameInput, 'Workspace Sukses');

    const descInput = screen.getByLabelText(/Deskripsi/i);
    await user.type(descInput, 'Catatan kerja');

    const submitBtn = screen.getByRole('button', { name: 'Buat Workspace' });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    expect(handleSuccess).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'ws-new-123',
        name: 'Workspace Sukses'
      })
    );
  });

  test('tidak dapat ditutup saat submission masih berjalan', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const pendingRequest: { release?: () => void } = {};

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces`, async () => {
        await new Promise<void>((resolve) => {
          pendingRequest.release = resolve;
        });

        return HttpResponse.json(
          {
            workspace: {
              id: 'ws-slow',
              name: 'Workspace Lambat',
              description: null,
              role: 'owner',
              createdAt: '2026-11-07T10:00:00.000Z',
              updatedAt: '2026-11-07T10:00:00.000Z',
              archivedAt: null
            }
          },
          { status: 201 }
        );
      })
    );

    renderWithProviders(<CreateWorkspaceDialog open={true} onClose={handleClose} />);

    await user.type(screen.getByLabelText(/Nama Workspace/i), 'Workspace Lambat');
    await user.click(screen.getByRole('button', { name: 'Buat Workspace' }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Buat Workspace' })).toHaveAttribute(
        'aria-busy',
        'true'
      );
    });

    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog', { name: 'Buat Workspace Baru' })).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();

    pendingRequest.release?.();
    await waitFor(() => {
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  test('meminta konfirmasi sebelum membuang isian yang belum disimpan', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithProviders(<CreateWorkspaceDialog open={true} onClose={handleClose} />);

    await user.type(screen.getByLabelText(/Nama Workspace/i), 'Draft Workspace');

    await user.keyboard('{Escape}');
    expect(screen.getByTestId('discard-changes')).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Lanjutkan Mengedit' }));
    expect(screen.getByLabelText(/Nama Workspace/i)).toHaveValue('Draft Workspace');

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Buang Perubahan' }));

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('memetakan detail validasi backend ke field nama', async () => {
    const user = userEvent.setup();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Permintaan tidak lolos validasi skema.',
              requestId: 'req-detail',
              details: [{ path: 'body.name', message: 'Nama workspace ditolak backend.' }]
            }
          },
          { status: 422 }
        );
      })
    );

    renderWithProviders(<CreateWorkspaceDialog open={true} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nama Workspace/i), 'Nama Valid');
    await user.click(screen.getByRole('button', { name: 'Buat Workspace' }));

    await waitFor(() => {
      expect(screen.getByText('Nama workspace ditolak backend.')).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Nama Workspace/i)).toHaveAttribute('aria-invalid', 'true');
  });

  test('menampilkan pesan error dari backend jika pembuatan gagal', async () => {
    const user = userEvent.setup();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Nama workspace telah digunakan.',
              requestId: 'req-err'
            }
          },
          { status: 422 }
        );
      })
    );

    renderWithProviders(<CreateWorkspaceDialog open={true} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Nama Workspace/i), 'Nama Bentrok');
    await user.click(screen.getByRole('button', { name: 'Buat Workspace' }));

    await waitFor(() => {
      expect(screen.getByText('Nama workspace telah digunakan.')).toBeInTheDocument();
    });
  });
});
