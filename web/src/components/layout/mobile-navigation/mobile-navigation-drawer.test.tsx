import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { MobileNavigationDrawer } from '@/components/layout/mobile-navigation/mobile-navigation-drawer';

describe('MobileNavigationDrawer', () => {
  test('menutup lewat backdrop dan Escape', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<MobileNavigationDrawer onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Tutup navigasi' }));
    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
