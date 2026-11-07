import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FiPlus } from 'react-icons/fi';
import { describe, expect, test, vi } from 'vitest';
import { Button } from '@/components/ui/button/button';

describe('Button', () => {
  test('merender label dan variant', () => {
    render(
      <Button variant="danger" size="small">
        Hapus
      </Button>
    );

    expect(screen.getByRole('button', { name: 'Hapus' })).toHaveClass(
      'button--danger',
      'button--small'
    );
  });

  test('memanggil aksi saat diklik dan menolak klik saat disabled atau loading', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Simpan</Button>);

    await user.click(screen.getByRole('button', { name: 'Simpan' }));
    expect(onClick).toHaveBeenCalledOnce();

    rerender(
      <Button disabled onClick={onClick}>
        Simpan
      </Button>
    );
    expect(screen.getByRole('button', { name: 'Simpan' })).toBeDisabled();

    rerender(
      <Button loading leadingIcon={<FiPlus />} trailingIcon={<FiPlus />}>
        Simpan
      </Button>
    );
    expect(screen.getByRole('button', { name: 'Simpan' })).toHaveAttribute('aria-busy', 'true');
  });

  test('mengisi lebar ketika diminta', () => {
    render(<Button fullWidth>Lebar</Button>);

    expect(screen.getByRole('button', { name: 'Lebar' })).toHaveClass('button--full');
  });
});
