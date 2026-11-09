import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { TagBadge } from './TagBadge';

describe('TagBadge', () => {
  test('merender tanda # dan nama tag', () => {
    render(<TagBadge name="backend" />);

    expect(screen.getByText('#')).toBeInTheDocument();
    expect(screen.getByText('backend')).toBeInTheDocument();
  });

  test('menampilkan tombol lepas ketika onRemove diberikan', async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();

    render(<TagBadge name="backend" onRemove={onRemove} />);

    await user.click(screen.getByRole('button', { name: 'Lepas tag backend' }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  test('mendukung label aksesibel kustom', () => {
    render(<TagBadge name="backend" onRemove={vi.fn()} removeLabel="Hapus backend" />);

    expect(screen.getByRole('button', { name: 'Hapus backend' })).toBeInTheDocument();
  });

  test('menggabungkan className tambahan', () => {
    const { container } = render(<TagBadge name="backend" className="extra" />);
    expect(container.firstChild).toHaveClass('tag-badge', 'extra');
  });
});
