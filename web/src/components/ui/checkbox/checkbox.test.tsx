import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { Checkbox } from '@/components/ui/checkbox/checkbox';

describe('Checkbox', () => {
  test('berubah saat diklik dan mendukung indeterminate', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Checkbox label="Selesai" />);
    const checkbox = screen.getByRole('checkbox', { name: 'Selesai' });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    rerender(<Checkbox label="Selesai" indeterminate />);
    expect(screen.getByRole('checkbox', { name: 'Selesai' })).toBePartiallyChecked();
  });

  test('tidak berubah saat disabled', async () => {
    const user = userEvent.setup();
    render(<Checkbox label="Selesai" disabled />);

    const checkbox = screen.getByRole('checkbox', { name: 'Selesai' });
    await user.click(checkbox);
    expect(checkbox).not.toBeChecked();
  });
});
