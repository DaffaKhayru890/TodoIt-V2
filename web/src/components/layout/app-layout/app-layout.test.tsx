import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { AppRoutes } from '@/app/router/router';
import { mockViewport } from '@/test/utils/mock-viewport';
import { renderWithProviders } from '@/test/utils/render-with-providers';

describe('AppLayout', () => {
  test('menempatkan dua sidebar dan konten, primary collapsed default, secondary tidak', async () => {
    renderWithProviders(<AppRoutes />, '/inbox');

    expect(screen.getByRole('link', { name: 'Personal' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigasi aplikasi' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeInTheDocument();

    // Primary sidebar collapsed by default
    const app = document.querySelector('.app-layout');
    expect(app).toHaveClass('app-layout--primary-collapsed');
    expect(app).not.toHaveClass('app-layout--secondary-collapsed');

    // Tidak ada tombol toggle collapse pada kedua sidebar
    expect(screen.queryByRole('button', { name: 'Ciutkan workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bentangkan workspace' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ciutkan navigasi' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bentangkan navigasi' })).not.toBeInTheDocument();
  });

  test('membuka dan menutup drawer ponsel dengan Escape dan backdrop', async () => {
    mockViewport(true);
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, '/inbox');

    const openNavigation = screen.getByRole('button', { name: 'Buka navigasi' });
    await user.click(openNavigation);
    const dialog = screen.getByRole('dialog', { name: 'Navigasi aplikasi' });
    expect(dialog).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(openNavigation).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Buka workspace' }));
    expect(screen.getByRole('dialog', { name: 'Workspace' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Tutup navigasi' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('navigasi menutup drawer', async () => {
    mockViewport(true);
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, '/inbox');

    await user.click(screen.getByRole('button', { name: 'Buka navigasi' }));
    await user.click(screen.getByRole('link', { name: 'Today' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeInTheDocument();
  });

  test('hanya satu drawer yang terbuka', async () => {
    mockViewport(true);
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, '/inbox');

    await user.click(screen.getByRole('button', { name: 'Buka workspace' }));
    await user.click(screen.getByRole('button', { name: 'Buka navigasi' }));

    expect(screen.queryByRole('dialog', { name: 'Workspace' })).not.toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Navigasi aplikasi' })).toBeInTheDocument();
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'Tutup navigasi' })
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
