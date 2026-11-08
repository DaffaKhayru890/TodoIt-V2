import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { toTodo } from '../../models/todo.mapper';
import { TodoItem } from './TodoItem';

const workspaceId = '11111111-1111-4111-8111-111111111111';

describe('TodoItem', () => {
  test('merender judul, deskripsi, dan tautan detail', () => {
    const todo = toTodo(makeTodoDto());

    renderWithProviders(
      <TodoItem
        workspaceId={workspaceId}
        todo={todo}
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
      `/workspace/${workspaceId}`
    );

    expect(screen.getByRole('heading', { level: 3, name: 'Tugas contoh' })).toBeInTheDocument();
    expect(screen.getByText('Deskripsi contoh')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Buka detail tugas/i })).toHaveAttribute(
      'href',
      `/workspace/${workspaceId}/todos/${todo.id}`
    );
    expect(screen.getByRole('checkbox', { name: /Tandai tugas/i })).not.toBeChecked();
  });

  test('menandai visual completed dan mengubah label checkbox', () => {
    const todo = toTodo(
      makeTodoDto({ status: 'completed', completedAt: '2026-11-07T12:00:00.000Z' })
    );

    renderWithProviders(
      <TodoItem
        workspaceId={workspaceId}
        todo={todo}
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
      `/workspace/${workspaceId}`
    );

    expect(screen.getByRole('checkbox', { name: /Buka kembali tugas/i })).toBeChecked();
    expect(screen.getByText('Selesai')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3 })).toHaveClass('todo-item__title');
  });

  test('memanggil onToggleComplete dari checkbox', async () => {
    const user = userEvent.setup();
    const todo = toTodo(makeTodoDto());
    const handleToggle = vi.fn();

    renderWithProviders(
      <TodoItem
        workspaceId={workspaceId}
        todo={todo}
        onToggleComplete={handleToggle}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
      `/workspace/${workspaceId}`
    );

    await user.click(screen.getByRole('checkbox', { name: /Tandai tugas/i }));
    expect(handleToggle).toHaveBeenCalledWith(todo);
  });

  test('membuka menu aksi dan memanggil edit/delete tanpa navigasi', async () => {
    const user = userEvent.setup();
    const todo = toTodo(makeTodoDto());
    const handleEdit = vi.fn();
    const handleDelete = vi.fn();

    renderWithProviders(
      <TodoItem
        workspaceId={workspaceId}
        todo={todo}
        onToggleComplete={vi.fn()}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />,
      `/workspace/${workspaceId}`
    );

    await user.click(screen.getByRole('button', { name: /Aksi untuk Tugas contoh/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Ubah' }));
    expect(handleEdit).toHaveBeenCalledWith(todo);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Aksi untuk Tugas contoh/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Hapus' }));
    expect(handleDelete).toHaveBeenCalledWith(todo);
  });

  test('menonaktifkan checkbox saat pembaruan berjalan', () => {
    const todo = toTodo(makeTodoDto());

    renderWithProviders(
      <TodoItem
        workspaceId={workspaceId}
        todo={todo}
        isUpdating
        onToggleComplete={vi.fn()}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
      `/workspace/${workspaceId}`
    );

    expect(screen.getByRole('checkbox', { name: /Tandai tugas/i })).toBeDisabled();
  });
});
