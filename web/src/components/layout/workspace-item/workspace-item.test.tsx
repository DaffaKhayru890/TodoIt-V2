import { screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { workspaceFixtures } from '@/test/fixtures/workspaces';
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

    const link = screen.getByRole('link', { name: workspace.name });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText(workspace.mark)).toBeInTheDocument();
  });

  test('menampilkan mark yang dihasilkan otomatis jika tidak disertakan', () => {
    renderWithProviders(
      <WorkspaceItem workspace={{ id: 'ws-gen', name: 'Keluarga' }} collapsed={false} />
    );

    expect(screen.getByText('Keluarga')).toBeInTheDocument();
    expect(screen.getByText('K')).toBeInTheDocument();
  });

  test('menyertakan title attribute untuk long workspace name', () => {
    const longName = 'Workspace dengan nama yang sangat panjang melebihi batas container sidebar';
    renderWithProviders(
      <WorkspaceItem workspace={{ id: 'ws-long', name: longName }} collapsed={false} />
    );

    const link = screen.getByRole('link', { name: longName });
    expect(link).toHaveAttribute('title', longName);
  });
});
