import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { workspaceFixtures } from '@/app/navigation/workspace-fixtures';
import { PrimarySidebar } from '@/components/layout/primary-sidebar/primary-sidebar';
import { renderWithProviders } from '@/test/utils/render-with-providers';

describe('PrimarySidebar', () => {
  test('menampilkan workspace contoh, entri tambah, dan profil', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <PrimarySidebar collapsed={false} workspaces={workspaceFixtures} />,
      '/inbox'
    );

    expect(screen.getByRole('link', { name: 'TodoIt' })).toBeInTheDocument();
    expect(screen.getByText('Data contoh')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Personal' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Tambah workspace' })).toHaveAttribute(
      'href',
      '/workspaces/new'
    );
    expect(screen.getByText('Pengguna contoh')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Menu pengguna' }));
    expect(screen.getByRole('menuitem', { name: 'Pengaturan' })).toHaveAttribute(
      'href',
      '/settings'
    );
  });
});
