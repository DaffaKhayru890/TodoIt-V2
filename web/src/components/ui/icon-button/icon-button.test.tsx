import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiPlus } from 'react-icons/fi';
import { describe, expect, test, vi } from 'vitest';
import { IconButton } from '@/components/ui/icon-button/icon-button';

describe('IconButton', () => {
  test('memakai accessible label dan tooltip', async () => {
    const user = userEvent.setup();
    render(
      <IconButton label="Tambah" tooltip="Tambah item">
        <FiPlus />
      </IconButton>
    );

    const button = screen.getByRole('button', { name: 'Tambah' });
    await user.hover(button);

    expect(screen.getByRole('tooltip')).toHaveTextContent('Tambah item');
  });

  test('tidak dapat diklik saat disabled', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <IconButton label="Tambah" disabled onClick={onClick}>
        <FiPlus />
      </IconButton>
    );

    await user.click(screen.getByRole('button', { name: 'Tambah' }));
    expect(onClick).not.toHaveBeenCalled();
  });
});
