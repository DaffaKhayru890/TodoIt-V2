import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { labelFixtures } from '@/test/fixtures/labels';
import { toLabel } from '../../models/label.mapper';
import { LabelSelector } from './LabelSelector';

const labels = labelFixtures.map(toLabel);

describe('LabelSelector', () => {
  test('menampilkan pilihan Tanpa label dan seluruh label', () => {
    render(<LabelSelector labels={labels} selectedId={null} onChange={vi.fn()} />);

    expect(screen.getByLabelText('Label')).toHaveValue('');
    expect(screen.getByRole('option', { name: 'Tanpa label' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Bug' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Feature' })).toBeInTheDocument();
  });

  test('memilih label dan mengosongkan pilihan', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(<LabelSelector labels={labels} selectedId={null} onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText('Label'), labels[0]!.id);
    expect(onChange).toHaveBeenCalledWith(labels[0]!.id);

    onChange.mockClear();
    await user.selectOptions(screen.getByLabelText('Label'), '');
    expect(onChange).toHaveBeenCalledWith(null);
  });

  test('menampilkan state loading, error, dan kosong', () => {
    const { rerender } = render(
      <LabelSelector labels={undefined} selectedId={null} onChange={vi.fn()} isLoading />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Memuat label...');

    rerender(<LabelSelector labels={[]} selectedId={null} onChange={vi.fn()} isError />);
    expect(screen.getByRole('alert')).toHaveTextContent('Gagal memuat label.');
    expect(screen.queryByLabelText('Label')).not.toBeInTheDocument();

    rerender(<LabelSelector labels={[]} selectedId={null} onChange={vi.fn()} />);
    expect(screen.getByText('Belum ada label di workspace ini.')).toBeInTheDocument();
  });

  test('memanggil onRetry saat Coba lagi ditekan', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(
      <LabelSelector
        labels={[]}
        selectedId={null}
        onChange={vi.fn()}
        isError
        onRetry={onRetry}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('menonaktifkan select ketika disabled', () => {
    render(<LabelSelector labels={labels} selectedId={null} onChange={vi.fn()} disabled />);

    expect(screen.getByLabelText('Label')).toBeDisabled();
  });
});
