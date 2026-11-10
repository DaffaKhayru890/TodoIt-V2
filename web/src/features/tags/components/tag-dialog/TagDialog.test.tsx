import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import { makeTagDto } from '@/test/fixtures/tags';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { toTag } from '../../models/tag.mapper';
import { TagDialog } from './TagDialog';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const tag = toTag(makeTagDto());

describe('TagDialog', () => {
  test('merender mode buat dengan field nama tag', () => {
    renderWithProviders(<TagDialog open workspaceId={workspaceId} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Buat Tag Baru' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nama Tag')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Buat Tag' })).toBeEnabled();
  });

  test('merender mode ubah dengan nilai awal dan tombol nonaktif sampai berubah', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TagDialog open workspaceId={workspaceId} tag={tag} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Ubah Tag' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nama Tag')).toHaveValue('backend');
    expect(screen.getByRole('button', { name: 'Simpan Perubahan' })).toBeDisabled();

    await user.type(screen.getByLabelText('Nama Tag'), ' api');
    expect(screen.getByRole('button', { name: 'Simpan Perubahan' })).toBeEnabled();
  });

  test('menolak nama kosong tanpa memanggil API', async () => {
    const user = userEvent.setup();

    renderWithProviders(<TagDialog open workspaceId={workspaceId} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Buat Tag' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Nama tag wajib diisi');
  });

  test('membuat tag, menutup dialog, dan memanggil onSuccess', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, async ({ request }) => {
        expect(await request.json()).toEqual({ name: 'Frontend' });
        return HttpResponse.json({ tag: makeTagDto({ name: 'Frontend' }) }, { status: 201 });
      })
    );

    renderWithProviders(
      <TagDialog open workspaceId={workspaceId} onClose={handleClose} onSuccess={handleSuccess} />
    );

    await user.type(screen.getByLabelText('Nama Tag'), 'Frontend');
    await user.click(screen.getByRole('button', { name: 'Buat Tag' }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith(expect.objectContaining({ name: 'Frontend' }));
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  test('memperbarui tag melalui PATCH', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();

    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/tags/${tag.id}`,
        async ({ request }) => {
          expect(await request.json()).toEqual({ name: 'Backend API' });
          return HttpResponse.json({ tag: makeTagDto({ name: 'Backend API' }) });
        }
      )
    );

    renderWithProviders(
      <TagDialog
        open
        workspaceId={workspaceId}
        tag={tag}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />
    );

    await user.clear(screen.getByLabelText('Nama Tag'));
    await user.type(screen.getByLabelText('Nama Tag'), 'Backend API');
    await user.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    await waitFor(() =>
      expect(handleSuccess).toHaveBeenCalledWith(expect.objectContaining({ name: 'Backend API' }))
    );
  });

  test('memetakan error validasi server ke field nama', async () => {
    const user = userEvent.setup();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Data tidak valid.',
              requestId: 'req-422',
              details: [{ path: 'body.name', message: 'Nama tag sudah dipakai.' }]
            }
          },
          { status: 422 }
        );
      })
    );

    renderWithProviders(<TagDialog open workspaceId={workspaceId} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('Nama Tag'), 'backend');
    await user.click(screen.getByRole('button', { name: 'Buat Tag' }));

    expect(await screen.findByText('Nama tag sudah dipakai.')).toBeInTheDocument();
  });

  test('menampilkan error server umum dan tetap terbuka', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'TAG_NAME_TAKEN',
              message: 'Nama tag sudah digunakan.',
              requestId: 'req-409'
            }
          },
          { status: 409 }
        );
      })
    );

    renderWithProviders(<TagDialog open workspaceId={workspaceId} onClose={handleClose} />);

    await user.type(screen.getByLabelText('Nama Tag'), 'backend');
    await user.click(screen.getByRole('button', { name: 'Buat Tag' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Nama tag sudah digunakan.')
    );
    expect(handleClose).not.toHaveBeenCalled();
  });

  test('membatalkan dialog tanpa memanggil API', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithProviders(<TagDialog open workspaceId={workspaceId} onClose={handleClose} />);

    await user.type(screen.getByLabelText('Nama Tag'), 'Frontend');
    await user.click(screen.getByRole('button', { name: 'Batal' }));

    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
