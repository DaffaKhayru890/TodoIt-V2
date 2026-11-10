import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, test } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { UpcomingPage } from './UpcomingPage';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/workspace/:workspaceId/upcoming" element={<UpcomingPage />} />
    </Routes>,
    `/workspace/${workspaceId}/upcoming`
  );
}

function inDays(days: number, hour = 9): string {
  const now = new Date();
  return new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + days,
    hour,
    0,
    0,
    0
  ).toISOString();
}

function mockWorkspace() {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}`, () =>
      HttpResponse.json({
        workspace: {
          id: workspaceId,
          name: 'Proyek Alpha',
          description: null,
          role: 'owner',
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
          archivedAt: null
        }
      })
    )
  );
}

function mockUpcoming(items: ReturnType<typeof makeTodoDto>[]) {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/upcoming`, () =>
      HttpResponse.json({
        items,
        pagination: { limit: 100, hasMore: false, nextCursor: null }
      })
    )
  );
}

describe('UpcomingPage', () => {
  test('menampilkan skeleton saat tugas mendatang dimuat', () => {
    mockWorkspace();
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/upcoming`, async () => {
        await delay('infinite');
        return HttpResponse.json({ items: [], pagination: {} });
      })
    );

    renderPage();
    expect(screen.getByLabelText('Memuat tugas mendatang')).toBeInTheDocument();
  });

  test('menampilkan empty state ketika tidak ada tugas mendatang', async () => {
    mockWorkspace();
    mockUpcoming([]);

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Nothing scheduled ahead.' })
    ).toBeInTheDocument();
    expect(screen.getByText(/Tidak ada deadline mendatang/)).toBeInTheDocument();
  });

  test('mengelompokkan tugas berdasarkan tanggal dan mengecualikan tanpa tenggat', async () => {
    mockWorkspace();
    mockUpcoming([
      makeTodoDto({
        id: 'tomorrow',
        title: 'Rapat tim',
        status: 'todo',
        dueAt: inDays(1)
      }),
      makeTodoDto({
        id: 'later',
        title: 'Presentasi',
        status: 'todo',
        dueAt: inDays(3)
      }),
      makeTodoDto({
        id: 'no-due',
        title: 'Tanpa tenggat',
        status: 'todo',
        dueAt: null
      })
    ]);

    renderPage();

    expect(await screen.findByRole('heading', { name: 'Besok' })).toBeInTheDocument();
    expect(screen.getByText('Rapat tim')).toBeInTheDocument();
    expect(screen.getByText('Presentasi')).toBeInTheDocument();
    expect(screen.queryByText('Tanpa tenggat')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Ringkasan tugas mendatang')).toHaveTextContent('3 tugas');
  });

  test('menampilkan error dan mencoba ulang', async () => {
    mockWorkspace();
    let calls = 0;

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/upcoming`, () => {
        calls += 1;
        return HttpResponse.json(
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Gagal mengambil jadwal mendatang.',
              requestId: 'req-500'
            }
          },
          { status: 500 }
        );
      })
    );

    renderPage();

    expect(
      await screen.findByRole(
        'heading',
        { name: 'Gagal memuat tugas mendatang' },
        { timeout: 4000 }
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Gagal mengambil jadwal mendatang.')).toBeInTheDocument();

    const before = calls;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Coba lagi' }));
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });
});
