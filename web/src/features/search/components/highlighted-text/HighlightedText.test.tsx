import { render } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { HighlightedText } from './HighlightedText';

describe('HighlightedText', () => {
  test('merender mark untuk bagian yang cocok tanpa HTML injection', () => {
    const { container } = render(
      <HighlightedText text="Complete <backend> integration" query="backend" />
    );

    const mark = container.querySelector('mark');

    expect(mark).not.toBeNull();
    expect(mark).toHaveClass('search-highlight');
    expect(mark).toHaveTextContent('backend');
    expect(container.textContent).toBe('Complete <backend> integration');
  });

  test('tidak merender mark ketika query tidak cocok', () => {
    const { container } = render(<HighlightedText text="Frontend" query="backend" />);

    expect(container.querySelector('mark')).toBeNull();
    expect(container.textContent).toBe('Frontend');
  });
});
