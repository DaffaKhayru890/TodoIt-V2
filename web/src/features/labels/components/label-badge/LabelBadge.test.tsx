import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { LabelBadge } from './LabelBadge';

describe('LabelBadge', () => {
  test('merender nama label dengan warna latar dan teks kontras', () => {
    render(<LabelBadge name="Bug" color="#E74C3C" />);

    const badge = screen.getByText('Bug');
    expect(badge).toHaveStyle({ backgroundColor: '#E74C3C', color: '#FFFFFF' });
  });

  test('memakai teks hitam pada warna terang', () => {
    render(<LabelBadge name="Feature" color="#F39C12" />);

    expect(screen.getByText('Feature')).toHaveStyle({ color: '#000000' });
  });

  test('menggabungkan className tambahan', () => {
    render(<LabelBadge name="Bug" color="#E74C3C" className="extra" />);

    expect(screen.getByText('Bug')).toHaveClass('label-badge', 'extra');
  });
});
