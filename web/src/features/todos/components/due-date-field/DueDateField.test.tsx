import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { DueDateField } from './DueDateField';

const now = new Date(2026, 10, 9, 12, 0, 0, 0);

function Harness({ initial = '', error }: { readonly initial?: string; readonly error?: string }) {
  const [value, setValue] = useState(initial);
  return <DueDateField value={value} onChange={setValue} now={now} error={error} />;
}

describe('DueDateField', () => {
  test('menampilkan state tanpa tenggat dan input datetime-local', () => {
    render(<DueDateField value="" onChange={vi.fn()} now={now} />);

    expect(screen.getByLabelText('Tenggat Waktu')).toHaveValue('');
    expect(screen.getByText('Tanpa tenggat waktu.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Hapus tenggat waktu' })).not.toBeInTheDocument();
  });

  test('shortcut Hari ini, Besok, dan Minggu depan memakai jam 09:00 lokal', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<DueDateField value="" onChange={onChange} now={now} />);

    await user.click(screen.getByRole('button', { name: 'Hari ini' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-11-09T09:00');

    await user.click(screen.getByRole('button', { name: 'Besok' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-11-10T09:00');

    await user.click(screen.getByRole('button', { name: 'Minggu depan' }));
    expect(onChange).toHaveBeenLastCalledWith('2026-11-16T09:00');
  });

  test('mengubah nilai input dan memperlihatkan pratinjau', () => {
    render(<Harness />);

    fireEvent.change(screen.getByLabelText('Tenggat Waktu'), {
      target: { value: '2026-11-12T14:30' }
    });

    expect(screen.getByLabelText('Tenggat Waktu')).toHaveValue('2026-11-12T14:30');
    expect(screen.getByText(/Tenggat:/)).toHaveTextContent(/12.*Nov.*2026/);
  });

  test('tombol hapus mengosongkan nilai', async () => {
    const user = userEvent.setup();

    render(<Harness initial="2026-11-12T14:30" />);

    await user.click(screen.getByRole('button', { name: 'Hapus tenggat waktu' }));
    expect(screen.getByLabelText('Tenggat Waktu')).toHaveValue('');
    expect(screen.getByText('Tanpa tenggat waktu.')).toBeInTheDocument();
  });

  test('menampilkan error dan menandai input tidak valid', () => {
    render(
      <DueDateField
        value="2026-11-12T14:30"
        onChange={vi.fn()}
        now={now}
        error="Tanggal tidak valid."
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Tanggal tidak valid.');
    expect(screen.getByLabelText('Tenggat Waktu')).toHaveAttribute('aria-invalid', 'true');
  });

  test('menonaktifkan input dan shortcut ketika disabled', () => {
    render(<DueDateField value="" onChange={vi.fn()} now={now} disabled />);

    expect(screen.getByLabelText('Tenggat Waktu')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Hari ini' })).toBeDisabled();
  });
});
