import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { EmptyState } from '@/components/feedback/empty-state/empty-state';

describe('EmptyState', () => {
  test('menampilkan ilustrasi, teks, dan aksi', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <EmptyState
        title="Kosong"
        description="Belum ada data."
        action={
          <button type="button" onClick={onClick}>
            Aksi utama
          </button>
        }
        secondaryAction={<button type="button">Aksi kedua</button>}
      />
    );

    expect(screen.getByRole('img', { name: 'Ilustrasi daftar kosong' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Kosong' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Aksi utama' }));
    expect(onClick).toHaveBeenCalledOnce();
  });

  test('variant compact tetap menampilkan deskripsi', () => {
    render(<EmptyState compact title="Ringkas" description="Deskripsi ringkas." />);

    expect(screen.getByText('Deskripsi ringkas.')).toBeInTheDocument();
  });
});
