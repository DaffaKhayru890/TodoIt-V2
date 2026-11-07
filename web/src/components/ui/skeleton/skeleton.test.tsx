import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Skeleton } from '@/components/ui/skeleton/skeleton';

describe('Skeleton', () => {
  test('merender variant visual', () => {
    const { container, rerender } = render(<Skeleton />);
    expect(container.firstChild).toHaveClass('skeleton--text');

    rerender(<Skeleton variant="card" />);
    expect(container.firstChild).toHaveClass('skeleton--card');
    rerender(<Skeleton variant="avatar" />);
    expect(container.firstChild).toHaveClass('skeleton--avatar');
    rerender(<Skeleton variant="list" />);
    expect(container.firstChild).toHaveClass('skeleton--list');
  });
});
