import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import { makeLabelDto } from '@/test/fixtures/labels';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { toLabel } from '../../models/label.mapper';
import { DeleteLabelDialog } from './DeleteLabelDialog';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const label = toLabel(makeLabelDto());

describe('DeleteLabelDialog', () => {
  test('menampilkan nama label dan konsekuensi penghapusan', () => {
    renderWithProviders(
      <DeleteLabelDialog open workspaceId={workspaceId} label={label} onClose={vi.fn()} />
    );

    expect(screen.getByRole('dialog', { name: 'Hapus Label' })).toBeInTheDocument();
    expect(screen.getByText('Bug')).toBeInTheDocument();
    expect(screen.getByText(/labelnya dilepas/i)).toBeInTheDocument();
  });

  test('membatalkan tanpa memanggil API', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithProviders(
      <DeleteLabelDialog
        open
        workspaceId={workspaceId}
        label={label}
        onClose={handleClose}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Batal' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('menghapus label dan memanggil callback setelah sukses', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/labels/${label.id}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    renderWithProviders(
      <DeleteLabelDialog
        open
        workspaceId={workspaceId}
        label={label}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Hapus Label' }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  test('menampilkan error dan tetap terbuka ketika penghapusan gagal', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    server.use(
      http.delete(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels/${label.id}`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'LABEL_NOT_FOUND',
              message: 'Label tidak ditemukan.',
              requestId: 'req-404'
            }
          },
          { status: 404 }
        );
      })
    );

    renderWithProviders(
      <DeleteLabelDialog
        open
        workspaceId={workspaceId}
        label={label}
        onClose={handleClose}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Hapus Label' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Label tidak ditemukan.')
    );
    expect(handleClose).not.toHaveBeenCalled();
  });
});
