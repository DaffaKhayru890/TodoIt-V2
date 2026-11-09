import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { CreateTodoDialog } from './CreateTodoDialog';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';

describe('CreateTodoDialog', () => {
  test('merender form, konteks workspace, dan field dasar', () => {
    renderWithProviders(
      <CreateTodoDialog
        open
        workspaceId={workspaceId}
        workspaceName="Proyek Alpha"
        onClose={vi.fn()}
      />
    );

    expect(screen.getByRole('dialog', { name: 'Buat Tugas Baru' })).toBeInTheDocument();
    expect(screen.getByText('Proyek Alpha')).toBeInTheDocument();
    expect(screen.getByText('Tugas akan dibuat di workspace ini.')).toBeInTheDocument();
    expect(screen.getByLabelText(/Judul Tugas/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Deskripsi/i)).toBeInTheDocument();
  });

  test('tidak merender dialog ketika open bernilai false', () => {
    renderWithProviders(
      <CreateTodoDialog open={false} workspaceId={workspaceId} onClose={vi.fn()} />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('menampilkan validasi ketika judul kosong', async () => {
    const user = userEvent.setup();

    renderWithProviders(<CreateTodoDialog open workspaceId={workspaceId} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Buat Tugas' }));

    await waitFor(() => {
      expect(screen.getByText('Judul tugas wajib diisi')).toBeInTheDocument();
    });
  });

  test('berhasil membuat tugas, memanggil callback, dan mengirim payload benar', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();
    const created = makeTodoDto({ id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd' });

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, async ({ request }) => {
        const body = (await request.json()) as { title: string; description: string | null };
        expect(body).toEqual({
          title: 'Merancang halaman detail',
          description: 'Tentukan struktur konten.'
        });

        return HttpResponse.json({ todo: created }, { status: 201 });
      })
    );

    renderWithProviders(
      <CreateTodoDialog
        open
        workspaceId={workspaceId}
        onClose={handleClose}
        onSuccess={handleSuccess}
      />
    );

    await user.type(screen.getByLabelText(/Judul Tugas/i), 'Merancang halaman detail');
    await user.type(screen.getByLabelText(/Deskripsi/i), 'Tentukan struktur konten.');
    await user.click(screen.getByRole('button', { name: 'Buat Tugas' }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledWith(
        expect.objectContaining({ id: created.id }),
        undefined
      );
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  test('menampilkan validasi backend pada field title', async () => {
    const user = userEvent.setup();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Permintaan tidak lolos validasi skema.',
              requestId: 'req-422',
              details: [{ path: 'body.title', message: 'Judul ditolak backend.' }]
            }
          },
          { status: 422 }
        );
      })
    );

    renderWithProviders(<CreateTodoDialog open workspaceId={workspaceId} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Judul Tugas/i), 'Judul valid');
    await user.click(screen.getByRole('button', { name: 'Buat Tugas' }));

    await waitFor(() => {
      expect(screen.getByText('Judul ditolak backend.')).toBeInTheDocument();
    });
    expect(screen.getByLabelText(/Judul Tugas/i)).toHaveAttribute('aria-invalid', 'true');
  });

  test('menampilkan pesan error jaringan dan tetap membuka dialog', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () => {
        return HttpResponse.error();
      })
    );

    renderWithProviders(<CreateTodoDialog open workspaceId={workspaceId} onClose={handleClose} />);

    await user.type(screen.getByLabelText(/Judul Tugas/i), 'Tugas gagal');
    await user.click(screen.getByRole('button', { name: 'Buat Tugas' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Tidak dapat menghubungi server.');
    });
    expect(handleClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Judul Tugas/i)).toHaveValue('Tugas gagal');
  });

  test('mencegah pengiriman ganda selama request berjalan', async () => {
    const user = userEvent.setup();
    let calls = 0;
    let release: (() => void) | undefined;

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, async () => {
        calls += 1;
        await new Promise<void>((resolve) => {
          release = resolve;
        });

        return HttpResponse.json({ todo: makeTodoDto() }, { status: 201 });
      })
    );

    renderWithProviders(<CreateTodoDialog open workspaceId={workspaceId} onClose={vi.fn()} />);

    await user.type(screen.getByLabelText(/Judul Tugas/i), 'Tugas pending');
    const submit = screen.getByRole('button', { name: 'Buat Tugas' });
    await user.click(submit);
    await user.click(submit);

    await waitFor(() => {
      expect(submit).toHaveAttribute('aria-busy', 'true');
    });
    expect(calls).toBe(1);

    release?.();
  });

  test('meminta konfirmasi sebelum menutup form yang berisi perubahan', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithProviders(<CreateTodoDialog open workspaceId={workspaceId} onClose={handleClose} />);

    await user.type(screen.getByLabelText(/Judul Tugas/i), 'Draft tugas');
    await user.keyboard('{Escape}');

    expect(screen.getByTestId('discard-changes')).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Lanjutkan Mengedit' }));
    expect(screen.getByLabelText(/Judul Tugas/i)).toHaveValue('Draft tugas');

    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Buang Perubahan' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('dapat ditutup dengan Escape ketika belum ada perubahan', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithProviders(<CreateTodoDialog open workspaceId={workspaceId} onClose={handleClose} />);

    await user.keyboard('{Escape}');
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
