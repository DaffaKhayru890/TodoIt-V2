import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { tagFixtures } from '@/test/fixtures/tags';
import { toTag } from '../../models/tag.mapper';
import { TagSelector } from './TagSelector';

const tags = tagFixtures.map(toTag);

describe('TagSelector', () => {
  test('menampilkan state loading, kosong, dan error', () => {
    const { rerender } = render(
      <TagSelector tags={undefined} selectedIds={[]} onChange={vi.fn()} isLoading />
    );
    expect(screen.getByRole('status')).toHaveTextContent('Memuat tag...');

    rerender(<TagSelector tags={[]} selectedIds={[]} onChange={vi.fn()} />);
    expect(screen.getByText('Belum ada tag di workspace ini.')).toBeInTheDocument();

    rerender(
      <TagSelector
        tags={[]}
        selectedIds={[]}
        onChange={vi.fn()}
        isError
        onRetry={vi.fn()}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Gagal memuat tag.');
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });

  test('memanggil onRetry saat Coba lagi ditekan', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<TagSelector tags={[]} selectedIds={[]} onChange={vi.fn()} isError onRetry={onRetry} />);

    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('mencentang tag yang terpilih dan menambah tag baru', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagSelector
        tags={tags}
        selectedIds={[tags[0]!.id]}
        onChange={onChange}
      />
    );

    expect(screen.getByRole('checkbox', { name: 'backend' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'design' })).not.toBeChecked();

    await user.click(screen.getByRole('checkbox', { name: 'design' }));
    expect(onChange).toHaveBeenCalledWith([tags[0]!.id, tags[1]!.id]);
  });

  test('melepas tag yang sudah terpilih', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <TagSelector
        tags={tags}
        selectedIds={[tags[0]!.id, tags[1]!.id]}
        onChange={onChange}
      />
    );

    await user.click(screen.getByRole('checkbox', { name: 'backend' }));
    expect(onChange).toHaveBeenCalledWith([tags[1]!.id]);
  });

  test('menonaktifkan seluruh checkbox ketika disabled', () => {
    render(<TagSelector tags={tags} selectedIds={[]} onChange={vi.fn()} disabled />);

    expect(screen.getByRole('checkbox', { name: 'backend' })).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: 'design' })).toBeDisabled();
  });

  test('mendukung pesan kosong kustom', () => {
    render(
      <TagSelector
        tags={[]}
        selectedIds={[]}
        onChange={vi.fn()}
        emptyMessage="Tidak ada tag tersedia."
      />
    );

    expect(screen.getByText('Tidak ada tag tersedia.')).toBeInTheDocument();
  });
});
