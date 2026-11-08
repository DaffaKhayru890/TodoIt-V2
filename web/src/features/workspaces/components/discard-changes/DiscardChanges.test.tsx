import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { DiscardChanges } from './DiscardChanges';

describe('DiscardChanges', () => {
  test('menampilkan peringatan perubahan yang belum disimpan', () => {
    render(<DiscardChanges onKeepEditing={vi.fn()} onDiscard={vi.fn()} />);

    expect(screen.getByTestId('discard-changes')).toBeInTheDocument();
    expect(screen.getByText(/Perubahan belum disimpan/i)).toBeInTheDocument();
  });

  test('memanggil callback lanjut mengedit dan buang perubahan', async () => {
    const user = userEvent.setup();
    const handleKeepEditing = vi.fn();
    const handleDiscard = vi.fn();

    render(<DiscardChanges onKeepEditing={handleKeepEditing} onDiscard={handleDiscard} />);

    await user.click(screen.getByRole('button', { name: 'Lanjutkan Mengedit' }));
    expect(handleKeepEditing).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Buang Perubahan' }));
    expect(handleDiscard).toHaveBeenCalledTimes(1);
  });

  test('menonaktifkan aksi ketika proses berjalan', () => {
    render(<DiscardChanges onKeepEditing={vi.fn()} onDiscard={vi.fn()} busy />);

    expect(screen.getByRole('button', { name: 'Lanjutkan Mengedit' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Buang Perubahan' })).toBeDisabled();
  });
});
