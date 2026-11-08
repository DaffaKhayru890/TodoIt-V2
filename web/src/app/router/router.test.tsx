import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { AppRoutes } from '@/app/router/router';
import { renderWithProviders } from '@/test/utils/render-with-providers';

describe('AppRoutes', () => {
  test('rute akar membuka inbox', () => {
    renderWithProviders(<AppRoutes />, '/');

    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeInTheDocument();
  });

  test('navigasi menandai item aktif dan berpindah halaman', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, '/inbox');

    expect(screen.getByRole('link', { name: 'Inbox' })).toHaveAttribute('aria-current', 'page');

    // Navigasi workspace baru tersedia setelah daftar workspace selesai dimuat.
    expect(await screen.findByRole('link', { name: 'Personal' })).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Today' }));

    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Today' })).toHaveAttribute('aria-current', 'page');
  });

  test('akses langsung ke /workspaces/new membuka dialog pembuatan workspace', async () => {
    renderWithProviders(<AppRoutes />, '/workspaces/new');

    expect(await screen.findByRole('dialog', { name: 'Buat Workspace Baru' })).toBeInTheDocument();
  });

  test('akses langsung ke settings menampilkan placeholder', () => {
    renderWithProviders(<AppRoutes />, '/settings');

    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
  });

  test('rute yang tidak dikenal menampilkan halaman tidak ditemukan', () => {
    renderWithProviders(<AppRoutes />, '/tidak-ada');

    expect(screen.getByRole('heading', { name: 'Halaman tidak ditemukan' })).toBeInTheDocument();
  });

  test('login tidak menampilkan formulir palsu', () => {
    renderWithProviders(<AppRoutes />, '/login');

    expect(screen.getByRole('heading', { name: 'Masuk' })).toBeInTheDocument();
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });
});
