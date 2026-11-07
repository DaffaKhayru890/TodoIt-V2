import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test } from 'vitest';
import { Tooltip } from '@/components/ui/tooltip/tooltip';

describe('Tooltip', () => {
  test('muncul saat hover dan fokus keyboard', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip label="Info">
        <button type="button">Target</button>
      </Tooltip>
    );

    await user.hover(screen.getByRole('button', { name: 'Target' }));
    expect(screen.getByRole('tooltip')).toHaveTextContent('Info');

    await user.unhover(screen.getByRole('button', { name: 'Target' }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    await user.tab();
    expect(screen.getByRole('tooltip')).toHaveTextContent('Info');
  });
});
