import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { PrioritySelector } from './PrioritySelector';

describe('PrioritySelector', () => {
  test('merender seluruh pilihan prioritas backend', () => {
    render(<PrioritySelector value="low" onChange={vi.fn()} />);

    const select = screen.getByLabelText('Prioritas');
    expect(select).toHaveValue('low');
    expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Rendah',
      'Sedang',
      'Tinggi',
      'Mendesak'
    ]);
  });

  test('memanggil onChange dengan nilai baru', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<PrioritySelector value="low" onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('Prioritas'), 'urgent');
    expect(onChange).toHaveBeenCalledWith('urgent');
  });

  test('menampilkan error dan menandai input tidak valid', () => {
    render(<PrioritySelector value="low" onChange={vi.fn()} error="Prioritas tidak valid." />);

    expect(screen.getByRole('alert')).toHaveTextContent('Prioritas tidak valid.');
    expect(screen.getByLabelText('Prioritas')).toHaveAttribute('aria-invalid', 'true');
  });

  test('menonaktifkan select ketika disabled', () => {
    render(<PrioritySelector value="medium" onChange={vi.fn()} disabled />);

    expect(screen.getByLabelText('Prioritas')).toBeDisabled();
  });
});
