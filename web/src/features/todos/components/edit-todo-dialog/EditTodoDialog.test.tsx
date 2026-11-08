import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { toTodo } from '../../models/todo.mapper';
import { EditTodoDialog } from './EditTodoDialog';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const todo = toTodo(makeTodoDto({ id: todoId, workspaceId }));

describe('EditTodoDialog', () => {
  test('memuat nilai awal dari data todo backend', () => {
    renderWithProviders(<EditTodoDialog open todo={todo} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Ubah Tugas' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Judul Tugas/i)).toHaveValue('Tugas contoh');
    expect(screen.getByLabelText(/Deskripsi/i)).toHaveValue('Deskripsi contoh');
    expect(screen.getByRole('button', { name: 'Simpan Perubahan' })).toBeDisabled();
  });

  test('berhasil menyimpan perubahan dan mengirim hanya field yang berubah', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`,
        async ({ request }) => {
          const body = (await request.json()) as Record<string, unknown>;
          expect(body).toEqual({
            title: 'Judul setelah edit',
            description: 'Deskripsi setelah edit'
          });

          return HttpResponse.json({
            todo: makeTodoDto({
              id: todoId,
              workspaceId,
              title: 'Judul setelah edit',
              description: 'Deskripsi setelah edit'
            })
          });
        }
      )
    );

    renderWithProviders(
      <EditTodoDialog open todo={todo} onClose={handleClose} onSuccess={handleSuccess} />
    );

    const title = screen.getByLabelText(/Judul Tugas/i);
    await user.clear(title);
    await user.type(title, 'Judul setelah edit');

    const description = screen.getByLabelText(/Deskripsi/i);
    await user.clear(description);
    await user.type(description, 'Deskripsi setelah edit');

    await user.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  test('menampilkan error backend, tetap terbuka, dan mempertahankan isian', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'TODO_TITLE_TOO_LONG',
              message: 'Judul todo maksimal 200 karakter.',
              requestId: 'req-422'
            }
          },
          { status: 422 }
        );
      })
    );

    renderWithProviders(<EditTodoDialog open todo={todo} onClose={handleClose} />);

    const title = screen.getByLabelText(/Judul Tugas/i);
    await user.clear(title);
    await user.type(title, 'Judul yang ditolak');
    await user.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Judul todo maksimal 200 karakter.');
    });
    expect(handleClose).not.toHaveBeenCalled();
    expect(screen.getByLabelText(/Judul Tugas/i)).toHaveValue('Judul yang ditolak');
  });

  test('memetakan detail validasi ke field yang tepat', async () => {
    const user = userEvent.setup();

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Permintaan tidak lolos validasi skema.',
              requestId: 'req-422',
              details: [{ path: 'body.description', message: 'Deskripsi ditolak.' }]
            }
          },
          { status: 422 }
        );
      })
    );

    renderWithProviders(<EditTodoDialog open todo={todo} onClose={vi.fn()} />);

    const description = screen.getByLabelText(/Deskripsi/i);
    await user.clear(description);
    await user.type(description, 'Deskripsi baru');
    await user.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    await waitFor(() => {
      expect(screen.getByText('Deskripsi ditolak.')).toBeInTheDocument();
    });
  });

  test('menutup tanpa request jika perubahan hanya berupa spasi', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    let patchCalls = 0;

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        patchCalls += 1;
        return HttpResponse.json({ todo: makeTodoDto({ id: todoId, workspaceId }) });
      })
    );

    renderWithProviders(<EditTodoDialog open todo={todo} onClose={handleClose} />);

    await user.type(screen.getByLabelText(/Judul Tugas/i), '   ');
    await user.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    await waitFor(() => {
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
    expect(patchCalls).toBe(0);
  });

  test('meminta konfirmasi sebelum membuang perubahan', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithProviders(<EditTodoDialog open todo={todo} onClose={handleClose} />);

    const title = screen.getByLabelText(/Judul Tugas/i);
    await user.clear(title);
    await user.type(title, 'Draft perubahan');
    await user.keyboard('{Escape}');

    expect(screen.getByTestId('discard-changes')).toBeInTheDocument();
    expect(handleClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Buang Perubahan' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
