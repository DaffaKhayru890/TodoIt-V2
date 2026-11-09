import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { ProductivityEmptyState } from './ProductivityEmptyState';

describe('ProductivityEmptyState', () => {
  test('merender judul, deskripsi, dan ilustrasi Today', () => {
    render(
      <ProductivityEmptyState
        variant="today"
        title="You're all clear for today!"
        description="Tidak ada tugas yang jatuh tempo hari ini."
      />
    );

    expect(
      screen.getByRole('heading', { name: "You're all clear for today!" })
    ).toBeInTheDocument();
    expect(screen.getByText('Tidak ada tugas yang jatuh tempo hari ini.')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Ilustrasi tidak ada tugas' })).toBeInTheDocument();
  });

  test('merender ilustrasi berbeda untuk Upcoming', () => {
    const { container } = render(
      <ProductivityEmptyState
        variant="upcoming"
        title="Nothing scheduled ahead."
        description="Tidak ada deadline mendatang."
      />
    );

    expect(container.querySelector('circle')).toBeInTheDocument();
  });
});
