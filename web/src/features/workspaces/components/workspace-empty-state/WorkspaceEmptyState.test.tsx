import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { WorkspaceEmptyState } from './WorkspaceEmptyState';

describe('WorkspaceEmptyState', () => {
  test('merender judul dan deskripsi kosong dengan benar', () => {
    render(<WorkspaceEmptyState />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Your workspace is ready!' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Workspace ini masih kosong. Kamu dapat mulai mengorganisasi pekerjaan dan membuat todolist di sini.'
      )
    ).toBeInTheDocument();
  });
});
