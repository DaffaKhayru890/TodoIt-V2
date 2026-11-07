import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { AppRoutes } from '@/app/router/router';
import { renderWithProviders } from '@/test/utils/render-with-providers';

describe('AppRoutes', () => {
  test('menampilkan placeholder pada rute akar', () => {
    renderWithProviders(<AppRoutes />);

    expect(screen.getByRole('button', { name: 'Tombol contoh' })).toBeInTheDocument();
  });

  test('berpindah ke halaman tidak ditemukan', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />);

    await user.click(screen.getByRole('link', { name: 'Buka rute yang tidak dikenal' }));

    expect(screen.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeInTheDocument();
  });

  test('rute yang tidak dikenal langsung menampilkan halaman tidak ditemukan', () => {
    renderWithProviders(<AppRoutes />, '/tidak-ada');

    expect(screen.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeInTheDocument();
  });
});
