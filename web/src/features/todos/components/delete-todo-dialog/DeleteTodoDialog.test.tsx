import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test, vi } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { toTodo } from '../../models/todo.mapper';
import { DeleteTodoDialog } from './DeleteTodoDialog';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const todo = toTodo(makeTodoDto({ id: todoId, workspaceId }));

describe('DeleteTodoDialog', () => {
  test('menampilkan nama tugas dan peringatan penghapusan', () => {
    renderWithProviders(<DeleteTodoDialog open todo={todo} onClose={vi.fn()} />);

    expect(screen.getByRole('dialog', { name: 'Hapus Tugas' })).toBeInTheDocument();
    expect(screen.getByText('Tugas contoh')).toBeInTheDocument();
    expect(screen.getByText('Hapus tugas ini?')).toBeInTheDocument();
    expect(screen.getByText(/tidak dapat dipulihkan melalui aplikasi/i)).toBeInTheDocument();
  });

  test('membatalkan tanpa memanggil API', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    renderWithProviders(<DeleteTodoDialog open todo={todo} onClose={handleClose} />);

    await user.click(screen.getByRole('button', { name: 'Batal' }));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  test('menghapus tugas dan memanggil callback setelah sukses', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();
    const handleSuccess = vi.fn();

    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    renderWithProviders(
      <DeleteTodoDialog open todo={todo} onClose={handleClose} onSuccess={handleSuccess} />
    );

    await user.click(screen.getByRole('button', { name: 'Hapus Tugas' }));

    await waitFor(() => {
      expect(handleSuccess).toHaveBeenCalledTimes(1);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  test('menampilkan error dan tetap terbuka ketika penghapusan gagal', async () => {
    const user = userEvent.setup();
    const handleClose = vi.fn();

    server.use(
      http.delete(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'TODO_NOT_FOUND',
              message: 'Todo tidak ditemukan.',
              requestId: 'req-404'
            }
          },
          { status: 404 }
        );
      })
    );

    renderWithProviders(<DeleteTodoDialog open todo={todo} onClose={handleClose} />);

    await user.click(screen.getByRole('button', { name: 'Hapus Tugas' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Todo tidak ditemukan.');
    });
    expect(handleClose).not.toHaveBeenCalled();
  });
});
