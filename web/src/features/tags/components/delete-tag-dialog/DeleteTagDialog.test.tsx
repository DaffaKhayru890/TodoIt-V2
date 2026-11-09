import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import { makeTagDto } from '@/test/fixtures/tags';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { toTag } from '../../models/tag.mapper';
import { DeleteTagDialog } from './DeleteTagDialog';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const tag = toTag(makeTagDto());

describe('DeleteTagDialog', () => {
  test('menampilkan nama tag dan konsekuensi penghapusan', () => {
    renderWithProviders(
      <DeleteTagDialog open workspaceId={workspaceId} tag={tag} onClose={vi.fn()} />
    );

    expect(screen.getByRole('dialog', { name: 'Hapus Tag' })).toBeInTheDocument();
    expect(screen.getByText('#backend')).toBeInTheDocument();
    expect(screen.getByText(/dilepas dari seluruh tugas/i)).toBeInTheDocument();
  });

  test('membatalkan tanpa memanggil API', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithProviders(
      <DeleteTagDialog open workspaceId={workspaceId} tag={tag} onClose={handleClose} />
    );

    await user.click(screen.getByRole('button', { name: 'Batal' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('menghapus tag dan memanggil callback setelah sukses', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/tags/${tag.id}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    renderWithProviders(
      <DeleteTagDialog
        open
        workspaceId={workspaceId}
        tag={tag}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Hapus Tag' }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  test('menampilkan error dan tetap terbuka ketika penghapusan gagal', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    server.use(
      http.delete(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags/${tag.id}`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'TAG_NOT_FOUND',
              message: 'Tag tidak ditemukan.',
              requestId: 'req-404'
            }
          },
          { status: 404 }
        );
      })
    );

    renderWithProviders(
      <DeleteTagDialog open workspaceId={workspaceId} tag={tag} onClose={handleClose} />
    );

    await user.click(screen.getByRole('button', { name: 'Hapus Tag' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Tag tidak ditemukan.')
    );
    expect(handleClose).not.toHaveBeenCalled();
  });
});
