import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { AppRoutes } from '@/app/router/router';
import { mockViewport } from '@/test/utils/mock-viewport';
import { renderWithProviders } from '@/test/utils/render-with-providers';

describe('AppLayout', () => {
  test('menempatkan dua sidebar dan konten, lalu menciutkan keduanya', async () => {
    const user = userEvent.setup();
    renderWithProviders(<AppRoutes />, '/inbox');

    expect(screen.getByRole('link', { name: 'Personal' })).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Navigasi aplikasi' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Inbox' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Ciutkan workspace' }));
    expect(screen.getByRole('button', { name: 'Bentangkan workspace' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(localStorage.getItem('todoit.sidebar')).toContain('"primaryCollapsed":true');

    await user.click(screen.getByRole('button', { name: 'Ciutkan navigasi' }));
    expect(screen.getByRole('button', { name: 'Bentangkan navigasi' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await user.hover(screen.getByRole('link', { name: 'Inbox' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Inbox');
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
