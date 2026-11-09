import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { TodoSortControl } from './TodoSortControl';

describe('TodoSortControl', () => {
  test('merender field sorting dan arah saat ini', () => {
    render(
      <TodoSortControl sort={{ field: 'createdAt', direction: 'desc' }} onChange={vi.fn()} />
    );

    expect(screen.getByLabelText('Urutkan')).toHaveValue('createdAt');
    expect(
      screen.getByRole('button', { name: 'Arah pengurutan: Turun. Klik untuk mengubah.' })
    ).toHaveAttribute('aria-pressed', 'true');
  });

  test('mengubah field sorting tanpa mengubah arah', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TodoSortControl sort={{ field: 'createdAt', direction: 'desc' }} onChange={onChange} />
    );

    await user.selectOptions(screen.getByLabelText('Urutkan'), 'priority');
    expect(onChange).toHaveBeenCalledWith({ field: 'priority', direction: 'desc' });
  });

  test('membalik arah sorting', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TodoSortControl sort={{ field: 'title', direction: 'asc' }} onChange={onChange} />
    );

    await user.click(
      screen.getByRole('button', { name: 'Arah pengurutan: Naik. Klik untuk mengubah.' })
    );
    expect(onChange).toHaveBeenCalledWith({ field: 'title', direction: 'desc' });
  });

  test('menonaktifkan kontrol ketika disabled', () => {
    render(
      <TodoSortControl
        sort={{ field: 'title', direction: 'asc' }}
        onChange={vi.fn()}
        disabled
      />
    );

    expect(screen.getByLabelText('Urutkan')).toBeDisabled();
    expect(screen.getByRole('button', { name: /Arah pengurutan/ })).toBeDisabled();
  });
});
