import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import { makeLabelDto } from '@/test/fixtures/labels';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { toLabel } from '../../models/label.mapper';
import { LabelDialog } from './LabelDialog';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const label = toLabel(makeLabelDto());

describe('LabelDialog', () => {
  test('merender mode buat dengan nama, warna default, dan deskripsi', () => {
    renderWithProviders(
      <LabelDialog open workspaceId={workspaceId} onClose={vi.fn()} />
    );

    expect(screen.getByRole('dialog', { name: 'Buat Label Baru' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nama Label')).toHaveValue('');
    expect(screen.getByLabelText('Warna khusus')).toHaveValue('#3498db');
    expect(screen.getByText('#3498DB')).toBeInTheDocument();
    expect(screen.getByLabelText('Deskripsi (opsional)')).toHaveValue('');
  });

  test('merender mode ubah dengan nilai awal', () => {
    renderWithProviders(
      <LabelDialog open workspaceId={workspaceId} label={label} onClose={vi.fn()} />
    );

    expect(screen.getByRole('dialog', { name: 'Ubah Label' })).toBeInTheDocument();
    expect(screen.getByLabelText('Nama Label')).toHaveValue('Bug');
    expect(screen.getByText('#E74C3C')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Simpan Perubahan' })).toBeDisabled();
  });

  test('memilih warna preset memperbarui nilai warna', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <LabelDialog open workspaceId={workspaceId} onClose={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: 'Pilih warna #27AE60' }));

    expect(screen.getByRole('button', { name: 'Pilih warna #27AE60' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('#27AE60')).toBeInTheDocument();
  });

  test('menolak nama kosong tanpa memanggil API', async () => {
    const user = userEvent.setup();

    renderWithProviders(
      <LabelDialog open workspaceId={workspaceId} onClose={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: 'Buat Label' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Nama label wajib diisi');
  });

  test('membuat label dengan payload ternormalisasi', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, async ({ request }) => {
        expect(await request.json()).toEqual({
          name: 'Frontend',
          color: '#E74C3C',
          description: 'Pekerjaan UI'
        });

        return HttpResponse.json(
          {
            label: makeLabelDto({
              name: 'Frontend',
              color: '#E74C3C',
              description: 'Pekerjaan UI'
            })
          },
          { status: 201 }
        );
      })
    );

    renderWithProviders(
      <LabelDialog
        open
        workspaceId={workspaceId}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    await user.type(screen.getByLabelText('Nama Label'), 'Frontend');
    await user.click(screen.getByRole('button', { name: 'Pilih warna #E74C3C' }));
    await user.type(screen.getByLabelText('Deskripsi (opsional)'), 'Pekerjaan UI');
    await user.click(screen.getByRole('button', { name: 'Buat Label' }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Frontend' })
      );
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  test('description kosong dikirim sebagai null', async () => {
    const user = userEvent.setup();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, async ({ request }) => {
        expect(await request.json()).toEqual({
          name: 'Bug',
          color: '#3498DB',
          description: null
        });
        return HttpResponse.json({ label: makeLabelDto() }, { status: 201 });
      })
    );

    renderWithProviders(
      <LabelDialog open workspaceId={workspaceId} onClose={vi.fn()} />
    );

    await user.type(screen.getByLabelText('Nama Label'), 'Bug');
    await user.click(screen.getByRole('button', { name: 'Buat Label' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Buat Label Baru' })).not.toBeInTheDocument()
    );
  });

  test('memperbarui label melalui PATCH', async () => {
    const user = userEvent.setup();
    const handleSuccess = vi.fn();

    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/labels/${label.id}`,
        async ({ request }) => {
          expect(await request.json()).toEqual({
            name: 'Defect',
            color: '#E74C3C',
            description: null
          });
          return HttpResponse.json({ label: makeLabelDto({ name: 'Defect' }) });
        }
      )
    );

    renderWithProviders(
      <LabelDialog
        open
        workspaceId={workspaceId}
        label={label}
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />
    );

    await user.clear(screen.getByLabelText('Nama Label'));
    await user.type(screen.getByLabelText('Nama Label'), 'Defect');
    await user.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    await waitFor(() =>
      expect(handleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Defect' })
      )
    );
  });

  test('memetakan error validasi warna ke field terkait', async () => {
    const user = userEvent.setup();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Data tidak valid.',
              requestId: 'req-422',
              details: [{ path: 'body.color', message: 'Warna harus format #RRGGBB.' }]
            }
          },
          { status: 422 }
        );
      })
    );

    renderWithProviders(
      <LabelDialog open workspaceId={workspaceId} onClose={vi.fn()} />
    );

    await user.type(screen.getByLabelText('Nama Label'), 'Bug');
    await user.click(screen.getByRole('button', { name: 'Buat Label' }));

    expect(await screen.findByText('Warna harus format #RRGGBB.')).toBeInTheDocument();
  });

  test('menampilkan error server umum dan tetap terbuka', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'LABEL_NAME_TAKEN',
              message: 'Nama label sudah digunakan.',
              requestId: 'req-409'
            }
          },
          { status: 409 }
        );
      })
    );

    renderWithProviders(
      <LabelDialog open workspaceId={workspaceId} onClose={handleClose} />
    );

    await user.type(screen.getByLabelText('Nama Label'), 'Bug');
    await user.click(screen.getByRole('button', { name: 'Buat Label' }));

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Nama label sudah digunakan.')
    );
    expect(handleClose).not.toHaveBeenCalled();
  });
});
