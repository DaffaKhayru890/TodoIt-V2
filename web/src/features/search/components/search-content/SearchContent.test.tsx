import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeLabelDto } from '@/test/fixtures/labels';
import { makeTagDto } from '@/test/fixtures/tags';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { SEARCH_RECENT_STORAGE_KEY } from '../../models/search.model';
import { SearchContent } from './SearchContent';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';

function mockWorkspaces(items = [{ id: workspaceId, name: 'Personal' }]) {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces`, () =>
      HttpResponse.json({
        items: items.map((workspace) => ({
          ...workspace,
          description: null,
          role: 'owner',
          createdAt: '2026-11-01T00:00:00.000Z'
        })),
        pagination: { limit: 50, offset: 0, total: items.length }
      })
    )
  );
}

function mockSearchResults() {
  mockWorkspaces();
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () =>
      HttpResponse.json({
        items: [
          makeTodoDto({ title: 'Backend integration', description: 'Selesaikan endpoint backend' })
        ],
        pagination: { limit: 8, hasMore: false, nextCursor: null }
      })
    ),
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () =>
      HttpResponse.json({
        items: [makeTagDto({ name: 'backend' })],
        pagination: { limit: 5, hasMore: false, nextCursor: null }
      })
    ),
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () =>
      HttpResponse.json({
        items: [makeLabelDto({ name: 'Backend layer' })],
        pagination: { limit: 5, hasMore: false, nextCursor: null }
      })
    )
  );
}

function renderContent(onClose = vi.fn()) {
  return {
    onClose,
    ...renderWithProviders(<SearchContent onClose={onClose} />, '/search')
  };
}

async function findTodoOption(): Promise<HTMLElement> {
  const options = await screen.findAllByRole('option');
  const option = options.find((candidate) =>
    candidate.textContent?.includes('Backend integration')
  );

  expect(option).toBeDefined();
  return option as HTMLElement;
}

describe('SearchContent', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test('menampilkan state awal dengan riwayat kosong', () => {
    renderContent();

    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByText('Pencarian terakhir')).toBeInTheDocument();
    expect(screen.getByText(/Belum ada pencarian terakhir/i)).toBeInTheDocument();
  });

  test('mencari setelah query memenuhi panjang minimum dan menampilkan hasil terkelompok', async () => {
    const user = userEvent.setup();
    mockSearchResults();
    renderContent();

    await user.type(screen.getByRole('combobox'), 'backend');

    const todoOption = await findTodoOption();

    expect(screen.getByText('Tugas')).toBeInTheDocument();
    expect(screen.getByText('Tag')).toBeInTheDocument();
    expect(screen.getByText('Label')).toBeInTheDocument();
    expect(todoOption.querySelector('mark')).not.toBeNull();
    expect(screen.getByRole('listbox', { name: 'Hasil pencarian' })).toBeInTheDocument();
  });

  test('menampilkan petunjuk ketika query terlalu pendek', async () => {
    const user = userEvent.setup();
    renderContent();

    await user.type(screen.getByRole('combobox'), 'b');

    expect(screen.getAllByText(/Ketik minimal 2 karakter/i).length).toBeGreaterThan(0);
  });

  test('menampilkan empty state ketika tidak ada hasil', async () => {
    const user = userEvent.setup();
    mockWorkspaces();
    renderContent();

    await user.type(screen.getByRole('combobox'), 'tidak-ada');

    expect(await screen.findByText('Tidak ada hasil')).toBeInTheDocument();
  });

  test('membuka item hasil dan menyimpan query ke riwayat', async () => {
    const user = userEvent.setup();
    mockSearchResults();
    const { onClose } = renderContent();

    await user.type(screen.getByRole('combobox'), 'backend');
    await user.click(await findTodoOption());

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(JSON.parse(localStorage.getItem(SEARCH_RECENT_STORAGE_KEY) ?? '[]')).toEqual([
      'backend'
    ]);
  });

  test('navigasi keyboard memilih hasil dan Enter membukanya', async () => {
    const user = userEvent.setup();
    mockSearchResults();
    const { onClose } = renderContent();

    await user.type(screen.getByRole('combobox'), 'backend');
    await findTodoOption();

    await user.keyboard('{ArrowDown}');

    const selected = screen
      .getAllByRole('option')
      .find((option) => option.getAttribute('aria-selected') === 'true');
    expect(selected).toBeDefined();
    expect(selected).toHaveAttribute('id');
    expect(screen.getByRole('combobox')).toHaveAttribute(
      'aria-activedescendant',
      selected?.getAttribute('id')
    );

    await user.keyboard('{Enter}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  test('Enter tanpa item aktif hanya menyimpan riwayat pencarian', async () => {
    const user = userEvent.setup();
    mockWorkspaces();
    renderContent();

    await user.type(screen.getByRole('combobox'), 'backend');
    await waitFor(() =>
      expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'true')
    );
    await user.keyboard('{Enter}');

    expect(JSON.parse(localStorage.getItem(SEARCH_RECENT_STORAGE_KEY) ?? '[]')).toEqual([
      'backend'
    ]);
  });

  test('riwayat dapat dipilih, dihapus satu per satu, dan dibersihkan', async () => {
    const user = userEvent.setup();
    localStorage.setItem(SEARCH_RECENT_STORAGE_KEY, JSON.stringify(['backend', 'design']));
    mockWorkspaces();
    renderContent();

    await user.click(screen.getByRole('button', { name: 'Hapus pencarian design' }));
    expect(
      screen.queryByRole('button', { name: 'Hapus pencarian design' })
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'backend' }));
    expect(screen.getByRole('combobox')).toHaveValue('backend');

    await user.click(screen.getByRole('button', { name: 'Hapus kata pencarian' }));
    await user.click(screen.getByRole('button', { name: 'Hapus semua' }));

    expect(screen.getByText(/Belum ada pencarian terakhir/i)).toBeInTheDocument();
  });

  test('tombol hapus kata pencarian mengosongkan input', async () => {
    const user = userEvent.setup();
    mockWorkspaces();
    renderContent();

    await user.type(screen.getByRole('combobox'), 'backend');
    await user.click(screen.getByRole('button', { name: 'Hapus kata pencarian' }));

    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  test('menampilkan error pencarian dan tombol coba lagi', async () => {
    const user = userEvent.setup();
    mockWorkspaces();
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Gagal.', requestId: 'req-1' } },
          { status: 500 }
        )
      ),
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Gagal.', requestId: 'req-2' } },
          { status: 500 }
        )
      ),
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Gagal.', requestId: 'req-3' } },
          { status: 500 }
        )
      )
    );
    renderContent();

    await user.type(screen.getByRole('combobox'), 'backend');

    expect(
      await screen.findByText('Pencarian gagal diproses. Silakan coba lagi.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Coba lagi' })).toBeInTheDocument();
  });

  test('menampilkan error daftar workspace', async () => {
    const user = userEvent.setup();
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces`, () =>
        HttpResponse.json(
          { error: { code: 'INTERNAL_ERROR', message: 'Gagal.', requestId: 'req-4' } },
          { status: 500 }
        )
      )
    );
    renderContent();

    await user.type(screen.getByRole('combobox'), 'backend');

    expect(
      await screen.findByText('Gagal memuat daftar workspace untuk pencarian.')
    ).toBeInTheDocument();
  });

  test('menampilkan petunjuk ketika belum ada workspace', async () => {
    const user = userEvent.setup();
    mockWorkspaces([]);
    renderContent();

    await user.type(screen.getByRole('combobox'), 'backend');

    expect(await screen.findByText(/Belum ada workspace yang dapat dicari/i)).toBeInTheDocument();
  });
});
