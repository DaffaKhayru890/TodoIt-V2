import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { Badge } from '@/components/ui/badge/badge';

describe('Badge', () => {
  test('merender variant', () => {
    render(<Badge variant="success">Selesai</Badge>);

    expect(screen.getByText('Selesai')).toHaveClass('badge--success');
  });
});
