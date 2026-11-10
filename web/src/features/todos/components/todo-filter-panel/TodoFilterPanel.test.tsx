import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, test, vi } from 'vitest';
import { labelFixtures } from '@/test/fixtures/labels';
import { tagFixtures } from '@/test/fixtures/tags';
import { toLabel } from '@/features/labels/models/label.mapper';
import { toTag } from '@/features/tags/models/tag.mapper';
import { EMPTY_TODO_FILTER, type TodoFilterState } from '../../models/todo-filter';
import { TodoFilterPanel } from './TodoFilterPanel';

const tags = tagFixtures.map(toTag);
const labels = labelFixtures.map(toLabel);

function filter(overrides: Partial<TodoFilterState> = {}): TodoFilterState {
  return { ...EMPTY_TODO_FILTER, ...overrides };
}

interface FilterPanelOverrides {
  readonly tags?: typeof tags;
  readonly labels?: typeof labels;
  readonly isLoadingTags?: boolean;
  readonly isLoadingLabels?: boolean;
  readonly disabled?: boolean;
}

function renderPanel(
  current: TodoFilterState = EMPTY_TODO_FILTER,
  overrides: FilterPanelOverrides = {}
) {
  const onChange = vi.fn();

  const result = render(
    <TodoFilterPanel
      filter={current}
      onChange={onChange}
      tags={tags}
      labels={labels}
      {...overrides}
    />
  );

  return { ...result, onChange };
}

function Harness({ initial }: { readonly initial?: TodoFilterState }) {
  const [current, setCurrent] = useState(initial ?? EMPTY_TODO_FILTER);

  return <TodoFilterPanel filter={current} onChange={setCurrent} tags={tags} labels={labels} />;
}

describe('TodoFilterPanel', () => {
  test('menampilkan catatan tanpa filter aktif dan tombol Filter', () => {
    renderPanel();

    expect(screen.getByRole('button', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.getByText('Tidak ada filter aktif.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Filter aktif')).not.toBeInTheDocument();
  });

  test('menampilkan jumlah filter aktif dan chip yang dapat dilepas', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel(
      filter({ status: 'active', priority: 'high', due: 'today', labelId: labels[0]!.id })
    );

    expect(screen.getByRole('button', { name: 'Filter (4)' })).toBeInTheDocument();

    const chips = screen.getByLabelText('Filter aktif');
    expect(within(chips).getByText('Status: Aktif')).toBeInTheDocument();
    expect(within(chips).getByText('Prioritas: Tinggi')).toBeInTheDocument();
    expect(within(chips).getByText('Tenggat: Hari ini')).toBeInTheDocument();
    expect(within(chips).getByText('Label: Bug')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hapus filter Status: Aktif' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'all' }));
  });

  test('mengubah status dan prioritas dari panel', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Filter' }));

    const panel = screen.getByLabelText('Panel filter tugas');
    await user.selectOptions(within(panel).getByLabelText('Filter status'), 'completed');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));

    await user.selectOptions(within(panel).getByLabelText('Filter prioritas'), 'urgent');
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ priority: 'urgent' }));
  });

  test('memilih tenggat custom menampilkan dan mengisi rentang tanggal', async () => {
    const user = userEvent.setup();

    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = screen.getByLabelText('Panel filter tugas');

    await user.selectOptions(within(panel).getByLabelText('Filter tenggat'), 'custom');

    expect(screen.getByLabelText('Dari')).toBeInTheDocument();
    expect(screen.getByLabelText('Sampai')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Dari'), '2026-11-01');
    expect(screen.getByLabelText('Dari')).toHaveValue('2026-11-01');
    expect(screen.getByLabelText('Sampai')).toHaveValue('');
  });

  test('mencentang tag menambah tagIds dan label dapat dipilih', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel();

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = screen.getByLabelText('Panel filter tugas');

    await user.click(within(panel).getByRole('checkbox', { name: 'backend' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tagIds: [tags[0]!.id] }));

    await user.selectOptions(within(panel).getByLabelText('Filter label'), labels[1]!.id);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ labelId: labels[1]!.id }));
  });

  test('melepas tag melalui chip', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel(filter({ tagIds: [tags[0]!.id, tags[1]!.id] }));

    expect(screen.getByText('Tag: backend')).toBeInTheDocument();
    expect(screen.getByText('Tag: design')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hapus filter Tag: backend' }));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ tagIds: [tags[1]!.id] }));
  });

  test('Hapus semua mengosongkan seluruh filter', async () => {
    const user = userEvent.setup();
    const { onChange } = renderPanel(filter({ status: 'completed', tagIds: [tags[0]!.id] }));

    await user.click(screen.getByRole('button', { name: 'Filter (2)' }));
    await user.click(screen.getByRole('button', { name: 'Hapus semua' }));

    expect(onChange).toHaveBeenCalledWith(EMPTY_TODO_FILTER);
  });

  test('menampilkan state loading dan kosong untuk tag/label', async () => {
    const user = userEvent.setup();
    renderPanel(EMPTY_TODO_FILTER, {
      tags: [],
      labels: [],
      isLoadingTags: true,
      isLoadingLabels: true
    });

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = screen.getByLabelText('Panel filter tugas');

    expect(within(panel).getByText('Memuat tag...')).toBeInTheDocument();
    expect(within(panel).getByText('Memuat label...')).toBeInTheDocument();
  });

  test('menampilkan state kosong ketika tag/label tidak tersedia', async () => {
    const user = userEvent.setup();
    renderPanel(EMPTY_TODO_FILTER, { tags: [], labels: [] });

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = screen.getByLabelText('Panel filter tugas');

    expect(within(panel).getByText('Belum ada tag di workspace ini.')).toBeInTheDocument();
    expect(within(panel).getByText('Belum ada label di workspace ini.')).toBeInTheDocument();
  });

  test('menonaktifkan kontrol ketika disabled', async () => {
    const user = userEvent.setup();
    renderPanel(EMPTY_TODO_FILTER, { disabled: true });

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = screen.getByLabelText('Panel filter tugas');

    expect(within(panel).getByLabelText('Filter status')).toBeDisabled();
    expect(within(panel).getByLabelText('Filter prioritas')).toBeDisabled();
    expect(within(panel).getByLabelText('Filter tenggat')).toBeDisabled();
    expect(within(panel).getByLabelText('Filter label')).toBeDisabled();
    expect(within(panel).getByRole('checkbox', { name: 'backend' })).toBeDisabled();
  });
});
