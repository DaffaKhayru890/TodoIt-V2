import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { SearchPopup } from '../search-popup/SearchPopup';
import { SearchTrigger } from './SearchTrigger';

describe('SearchTrigger', () => {
  test('memanggil onOpen ketika diklik', async () => {
    const user = userEvent.setup();
    const onOpen = vi.fn();

    renderWithProviders(<SearchTrigger collapsed={false} onOpen={onOpen} />);

    const button = screen.getByRole('button', { name: 'Cari di TodoIt' });

    expect(button).toHaveAttribute('aria-keyshortcuts', 'Control+K Meta+K');
    expect(screen.getByText('Ctrl K')).toBeInTheDocument();

    await user.click(button);

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  test('menyembunyikan label dan shortcut ketika collapsed', () => {
    renderWithProviders(<SearchTrigger collapsed onOpen={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'Cari di TodoIt' })).toBeInTheDocument();
    expect(document.querySelector('.search-trigger__shortcut')).toBeNull();
    expect(screen.getByText('Cari')).toHaveClass('visually-hidden');
  });
});

describe('SearchPopup', () => {
  test('tidak merender dialog ketika open bernilai false', () => {
    renderWithProviders(<SearchPopup open={false} onClose={vi.fn()} />, '/search');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('menampilkan dialog pencarian ketika open', () => {
    renderWithProviders(<SearchPopup open onClose={vi.fn()} />, '/search');

    expect(screen.getByRole('dialog', { name: 'Cari di TodoIt' })).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  test('menutup dialog melalui tombol tutup', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    renderWithProviders(<SearchPopup open onClose={onClose} />, '/search');

    await user.click(screen.getByRole('button', { name: 'Tutup' }));

    expect(onClose).toHaveBeenCalled();
  });
});
