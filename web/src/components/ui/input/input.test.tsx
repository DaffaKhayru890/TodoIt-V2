import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiSearch } from 'react-icons/fi';
import { describe, expect, test } from 'vitest';
import { Input } from '@/components/ui/input/input';

describe('Input', () => {
  test('menghubungkan label, hint, dan error', async () => {
    const user = userEvent.setup();
    render(
      <Input
        label="Judul"
        hint="Maksimal 200 karakter"
        error="Judul wajib diisi"
        leadingIcon={<FiSearch />}
        required
      />
    );

    const field = screen.getByLabelText('Judul');
    expect(field).toBeRequired();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Judul wajib diisi');
    await user.type(field, 'Catatan');
    expect(field).toHaveValue('Catatan');
  });

  test('bisa dinonaktifkan', () => {
    render(<Input label="Judul" disabled />);

    expect(screen.getByLabelText('Judul')).toBeDisabled();
  });
});
