import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import type { Workspace } from '../../models/workspace.model';
import { WorkspaceHeader } from './WorkspaceHeader';

const mockWorkspace: Workspace = {
  id: 'ws-header-1',
  name: 'Workspace Strategis',
  description: 'Fokus pada target kuartal ini',
  role: 'owner',
  createdAt: new Date('2026-11-01T00:00:00.000Z'),
  updatedAt: new Date('2026-11-01T00:00:00.000Z'),
  archivedAt: null,
  mark: 'W'
};

describe('WorkspaceHeader', () => {
  test('merender nama, deskripsi, mark, dan badge role', () => {
    render(<WorkspaceHeader workspace={mockWorkspace} />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Workspace Strategis' })
    ).toBeInTheDocument();
    expect(screen.getByText('Fokus pada target kuartal ini')).toBeInTheDocument();
    expect(screen.getByText('W')).toBeInTheDocument();
    expect(screen.getAllByText('Owner')).toHaveLength(2);
  });

  test('menampilkan tombol ubah dan arsipkan untuk owner', async () => {
    const user = userEvent.setup();
    const handleEdit = vi.fn();
    const handleArchive = vi.fn();

    render(
      <WorkspaceHeader workspace={mockWorkspace} onEdit={handleEdit} onArchive={handleArchive} />
    );

    const editBtn = screen.getByRole('button', { name: 'Ubah' });
    const archiveBtn = screen.getByRole('button', { name: 'Arsipkan' });

    expect(editBtn).toBeInTheDocument();
    expect(archiveBtn).toBeInTheDocument();

    await user.click(editBtn);
    expect(handleEdit).toHaveBeenCalledTimes(1);

    await user.click(archiveBtn);
    expect(handleArchive).toHaveBeenCalledTimes(1);
  });

  test('menyembunyikan tombol ubah dan arsipkan jika bukan owner', () => {
    const memberWorkspace: Workspace = {
      ...mockWorkspace,
      role: 'member'
    };

    render(<WorkspaceHeader workspace={memberWorkspace} />);

    expect(screen.queryByRole('button', { name: 'Ubah' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Arsipkan' })).not.toBeInTheDocument();
    expect(screen.getAllByText('Anggota')).toHaveLength(2);
  });
});
