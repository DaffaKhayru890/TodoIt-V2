import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Avatar } from '@/components/ui/avatar/avatar';

describe('Avatar', () => {
  test('menampilkan inisial ketika tidak ada gambar', () => {
    render(<Avatar name="Pengguna Contoh" size="large" tone="accent" />);

    expect(screen.getByRole('img', { name: 'Pengguna Contoh' })).toHaveTextContent('PC');
  });

  test('menampilkan gambar ketika sumber tersedia', () => {
    render(<Avatar name="Ada" src="/ada.png" />);

    expect(screen.getByRole('img', { name: 'Ada' })).toHaveAttribute('src', '/ada.png');
  });
});
