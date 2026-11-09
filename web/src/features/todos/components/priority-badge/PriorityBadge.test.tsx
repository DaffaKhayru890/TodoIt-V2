import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { PriorityBadge } from './PriorityBadge';

describe('PriorityBadge', () => {
  test.each([
    ['low', 'Rendah', 'priority-badge--low'],
    ['medium', 'Sedang', 'priority-badge--medium'],
    ['high', 'Tinggi', 'priority-badge--high'],
    ['urgent', 'Mendesak', 'priority-badge--urgent']
  ] as const)('merender prioritas %s sebagai %s', (priority, label, modifier) => {
    const { container } = render(<PriorityBadge priority={priority} />);

    expect(screen.getByText(label)).toBeInTheDocument();
    expect(container.firstChild).toHaveClass('priority-badge', modifier);
  });

  test('ikon selalu tersembunyi dari screen reader karena label teks tersedia', () => {
    const { container } = render(<PriorityBadge priority="urgent" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  test('menggabungkan className tambahan', () => {
    const { container } = render(<PriorityBadge priority="low" className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });
});
