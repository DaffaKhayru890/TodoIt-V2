import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { Textarea } from '@/components/ui/textarea/textarea';

describe('Textarea', () => {
  test('menampilkan label, error, dan menolak input saat disabled', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Textarea label="Deskripsi" error="Terlalu panjang" resize="none" />
    );

    const field = screen.getByLabelText('Deskripsi');
    expect(field).toHaveClass('field__textarea--none');
    expect(screen.getByRole('alert')).toHaveTextContent('Terlalu panjang');
    await user.type(field, 'Halo');
    expect(field).toHaveValue('Halo');

    rerender(<Textarea label="Deskripsi" disabled />);
    expect(screen.getByLabelText('Deskripsi')).toBeDisabled();
  });
});
