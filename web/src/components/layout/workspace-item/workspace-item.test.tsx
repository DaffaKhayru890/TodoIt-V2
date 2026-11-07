import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { workspaceFixtures } from '@/app/navigation/workspace-fixtures';
import { WorkspaceItem } from '@/components/layout/workspace-item/workspace-item';
import { renderWithProviders } from '@/test/utils/render-with-providers';

describe('WorkspaceItem', () => {
  test('menandai workspace yang sedang aktif', () => {
    const workspace = workspaceFixtures[0];
    if (!workspace) {
      throw new Error('Fixture workspace kosong.');
    }

    renderWithProviders(
      <WorkspaceItem workspace={workspace} collapsed={false} />,
      `/workspace/${workspace.id}`
    );

    expect(screen.getByRole('link', { name: workspace.name })).toHaveAttribute(
      'aria-current',
      'page'
    );
  });
});
