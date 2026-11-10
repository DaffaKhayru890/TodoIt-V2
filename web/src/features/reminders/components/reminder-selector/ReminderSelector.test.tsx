import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { ReminderSelector } from './ReminderSelector';

function Harness({
  hasDueDate = true,
  initial = null,
  error
}: {
  readonly hasDueDate?: boolean;
  readonly initial?: number | null;
  readonly error?: string;
}) {
  const [value, setValue] = useState<number | null>(initial);

  return (
    <ReminderSelector value={value} onChange={setValue} hasDueDate={hasDueDate} error={error} />
  );
}

describe('ReminderSelector', () => {
  test('menonaktifkan pengingat ketika belum ada tenggat', () => {
    render(<ReminderSelector value={null} onChange={vi.fn()} hasDueDate={false} />);

    expect(screen.getByRole('checkbox', { name: 'Aktifkan pengingat' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tetapkan tenggat waktu terlebih dahulu untuk mengaktifkan pengingat.'
    );
    expect(screen.queryByLabelText('Waktu pengingat')).not.toBeInTheDocument();
  });

  test('mengaktifkan pengingat memakai offset default 15 menit', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<ReminderSelector value={null} onChange={onChange} hasDueDate />);

    await user.click(screen.getByRole('checkbox', { name: 'Aktifkan pengingat' }));
    expect(onChange).toHaveBeenCalledWith(15);
  });

  test('harness memperlihatkan pilihan offset dan ringkasan', async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(screen.getByRole('checkbox', { name: 'Aktifkan pengingat' }));

    const select = screen.getByLabelText('Waktu pengingat');
    expect(select).toHaveValue('15');
    expect(screen.getByText(/Pengingat dijadwalkan 15 menit sebelum tenggat/)).toBeInTheDocument();

    await user.selectOptions(select, '60');
    expect(screen.getByText(/Pengingat dijadwalkan 1 jam sebelum tenggat/)).toBeInTheDocument();

    await user.click(screen.getByRole('checkbox', { name: 'Aktifkan pengingat' }));
    expect(screen.queryByText(/Pengingat dijadwalkan/)).not.toBeInTheDocument();
  });

  test('hanya menyediakan preset offset yang diterima backend', () => {
    render(<Harness initial={5} />);

    const values = screen
      .getAllByRole('option')
      .map((option) => Number((option as HTMLOptionElement).value));

    expect(values).toEqual([5, 15, 30, 60, 1440]);
    expect(values).not.toContain(0);
  });

  test('menampilkan error validasi', () => {
    render(
      <ReminderSelector
        value={15}
        onChange={vi.fn()}
        hasDueDate
        error="Pengingat memerlukan tenggat waktu."
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Pengingat memerlukan tenggat waktu.');
  });
});
