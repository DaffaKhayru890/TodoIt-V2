import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { Dropdown, DropdownItem } from '@/components/ui/dropdown/dropdown';
import { renderWithProviders } from '@/test/utils/render-with-providers';

describe('Dropdown', () => {
  test('membuka, memilih, lalu menutup dengan Escape dan klik luar', async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <Dropdown label="Aksi">
        <DropdownItem onSelect={onSelect}>Ubah</DropdownItem>
      </Dropdown>
    );

    await user.click(screen.getByRole('button', { name: 'Aksi' }));
    await user.click(screen.getByRole('menuitem', { name: 'Ubah' }));
    expect(onSelect).toHaveBeenCalledOnce();

    await user.click(screen.getByRole('button', { name: 'Aksi' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Aksi' }));
    await user.click(document.body);
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  test('item tautan berpindah rute', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Dropdown label="Menu">
        <DropdownItem to="/settings">Pengaturan</DropdownItem>
      </Dropdown>,
      '/inbox'
    );

    await user.click(screen.getByRole('button', { name: 'Menu' }));
    expect(screen.getByRole('menuitem', { name: 'Pengaturan' })).toHaveAttribute(
      'href',
      '/settings'
    );
  });
});
