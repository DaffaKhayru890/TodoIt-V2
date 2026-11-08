import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { TodoEmptyState } from './TodoEmptyState';

describe('TodoEmptyState', () => {
  test('menampilkan ilustrasi, judul, deskripsi, dan aksi', () => {
    render(<TodoEmptyState onCreate={vi.fn()} />);

    expect(screen.getByRole('img', { name: /Ilustrasi daftar tugas kosong/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Belum ada tugas!' })).toBeInTheDocument();
    expect(
      screen.getByText('Mulai dengan membuat task pertamamu dan atur pekerjaanmu di workspace ini.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buat tugas pertama' })).toBeInTheDocument();
  });

  test('memanggil onCreate ketika aksi ditekan', async () => {
    const user = userEvent.setup();
    const handleCreate = vi.fn();

    render(<TodoEmptyState onCreate={handleCreate} />);
    await user.click(screen.getByRole('button', { name: 'Buat tugas pertama' }));

    expect(handleCreate).toHaveBeenCalledTimes(1);
  });

  test('menonaktifkan aksi ketika diminta', () => {
    render(<TodoEmptyState onCreate={vi.fn()} disabled />);
    expect(screen.getByRole('button', { name: 'Buat tugas pertama' })).toBeDisabled();
  });
});
