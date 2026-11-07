import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { Popover } from '@/components/ui/popover/popover';

describe('Popover', () => {
  test('membuka dan menutup dengan Escape serta klik luar', async () => {
    const user = userEvent.setup();
    render(
      <Popover label="Detail">
        <p>Isi popover</p>
      </Popover>
    );

    await user.click(screen.getByRole('button', { name: 'Detail' }));
    expect(screen.getByText('Isi popover')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(screen.queryByText('Isi popover')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Detail' }));
    await user.click(document.body);
    expect(screen.queryByText('Isi popover')).not.toBeInTheDocument();
  });
});
