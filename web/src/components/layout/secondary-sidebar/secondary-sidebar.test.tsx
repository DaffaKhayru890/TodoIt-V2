import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { workspaceFixtures } from '@/app/navigation/workspace-fixtures';
import { SecondarySidebar } from '@/components/layout/secondary-sidebar/secondary-sidebar';
import { renderWithProviders } from '@/test/utils/render-with-providers';

describe('SecondarySidebar', () => {
  test('mengelompokkan navigasi dan menyembunyikan label saat diciutkan', () => {
    const workspace = workspaceFixtures[0];
    if (!workspace) {
      throw new Error('Fixture workspace kosong.');
    }

    renderWithProviders(<SecondarySidebar workspaceId={workspace.id} collapsed />, '/inbox');

    expect(screen.getByRole('navigation', { name: 'Pencarian' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'General' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Workspace' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Preferences' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Inbox' })).toBeInTheDocument();
  });
});
