import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { ApiError } from '@/core/errors/api-error';
import { makeTodoDto } from '@/test/fixtures/todos';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { toTodo } from '../../models/todo.mapper';
import { TodoList } from './TodoList';

const workspaceId = '11111111-1111-4111-8111-111111111111';

function renderList(overrides: Partial<ComponentProps<typeof TodoList>> = {}) {
  return renderWithProviders(
    <TodoList
      workspaceId={workspaceId}
      todos={[]}
      isLoading={false}
      isError={false}
      onRetry={vi.fn()}
      onCreate={vi.fn()}
      onEdit={vi.fn()}
      onDelete={vi.fn()}
      onToggleComplete={vi.fn()}
      {...overrides}
    />,
    `/workspace/${workspaceId}`
  );
}

describe('TodoList', () => {
  test('menampilkan skeleton saat loading awal', () => {
    renderList({ todos: undefined, isLoading: true });

    expect(screen.getByLabelText('Memuat daftar tugas')).toBeInTheDocument();
  });

  test('menampilkan empty state ketika tidak ada todo', () => {
    renderList({ todos: [] });

    expect(screen.getByRole('heading', { name: 'Belum ada tugas!' })).toBeInTheDocument();
  });

  test('menampilkan error state dan memanggil retry', async () => {
    const user = userEvent.setup();
    const handleRetry = vi.fn();

    renderList({
      todos: undefined,
      isError: true,
      error: new ApiError('Server sedang bermasalah.', 500),
      onRetry: handleRetry
    });

    expect(screen.getByRole('heading', { name: 'Gagal memuat tugas' })).toBeInTheDocument();
    expect(screen.getByText('Server sedang bermasalah.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(handleRetry).toHaveBeenCalledTimes(1);
  });

  test('memisahkan tugas aktif dan selesai berdasarkan status backend', () => {
    const active = toTodo(makeTodoDto({ id: 'active-1', title: 'Tugas aktif' }));
    const inProgress = toTodo(
      makeTodoDto({ id: 'active-2', title: 'Tugas dikerjakan', status: 'in_progress' })
    );
    const completed = toTodo(
      makeTodoDto({
        id: 'completed-1',
        title: 'Tugas selesai',
        status: 'completed',
        completedAt: '2026-11-07T12:00:00.000Z'
      })
    );

    renderList({ todos: [active, inProgress, completed] });

    const activeSection = screen.getByLabelText('Daftar tugas aktif');
    expect(within(activeSection).getByText('Tugas aktif')).toBeInTheDocument();
    expect(within(activeSection).getByText('Tugas dikerjakan')).toBeInTheDocument();
    expect(within(activeSection).queryByText('Tugas selesai')).not.toBeInTheDocument();

    const completedSection = screen.getByLabelText('Daftar tugas selesai');
    expect(within(completedSection).getByText('Tugas selesai')).toBeInTheDocument();
  });

  test('section selesai dapat diciutkan dan dibentangkan dengan aria-expanded', async () => {
    const user = userEvent.setup();
    const completed = toTodo(
      makeTodoDto({ status: 'completed', completedAt: '2026-11-07T12:00:00.000Z' })
    );

    renderList({ todos: [completed] });

    const toggle = screen.getByRole('button', { name: /Tugas Selesai/i });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByLabelText('Daftar tugas selesai')).toBeInTheDocument();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByLabelText('Daftar tugas selesai')).not.toBeVisible();
  });

  test('menampilkan informasi ketika semua tugas sudah selesai', () => {
    const completed = toTodo(
      makeTodoDto({ status: 'completed', completedAt: '2026-11-07T12:00:00.000Z' })
    );

    renderList({ todos: [completed] });

    expect(
      screen.getByText('Tidak ada tugas aktif. Semua tugas sudah selesai.')
    ).toBeInTheDocument();
  });

  test('menampilkan tombol Muat lebih banyak ketika masih ada halaman berikutnya', async () => {
    const user = userEvent.setup();
    const handleLoadMore = vi.fn();

    renderList({
      todos: [toTodo(makeTodoDto())],
      hasMore: true,
      onLoadMore: handleLoadMore
    });

    await user.click(screen.getByRole('button', { name: 'Muat lebih banyak' }));
    expect(handleLoadMore).toHaveBeenCalledTimes(1);
  });

  test('menampilkan indikator akhir daftar setelah beberapa halaman dimuat', () => {
    renderList({
      todos: [toTodo(makeTodoDto())],
      hasMore: false,
      loadedPageCount: 2
    });

    expect(screen.getByText('Semua tugas sudah dimuat.')).toBeInTheDocument();
  });

  test('mempertahankan item dan menampilkan error halaman berikutnya dengan retry', async () => {
    const user = userEvent.setup();
    const handleLoadMore = vi.fn();

    renderList({
      todos: [toTodo(makeTodoDto({ title: 'Tetap tampil' }))],
      hasMore: true,
      isFetchNextPageError: true,
      onLoadMore: handleLoadMore
    });

    expect(screen.getByText('Tetap tampil')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Gagal memuat tugas berikutnya.');

    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(handleLoadMore).toHaveBeenCalledTimes(1);
  });

  test('meneruskan aksi item ke handler', async () => {
    const user = userEvent.setup();
    const todo = toTodo(makeTodoDto());
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();
    const handleToggle = vi.fn();

    renderList({
      todos: [todo],
      onEdit: handleEdit,
      onDelete: handleDelete,
      onToggleComplete: handleToggle
    });

    await user.click(screen.getByRole('checkbox', { name: /Tandai tugas/i }));
    expect(handleToggle).toHaveBeenCalledWith(todo);

    await user.click(screen.getByRole('button', { name: /Aksi untuk Tugas contoh/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Ubah' }));
    expect(handleEdit).toHaveBeenCalledWith(todo);

    await user.click(screen.getByRole('button', { name: /Aksi untuk Tugas contoh/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hapus' }));
    expect(handleDelete).toHaveBeenCalledWith(todo);
  });
});
