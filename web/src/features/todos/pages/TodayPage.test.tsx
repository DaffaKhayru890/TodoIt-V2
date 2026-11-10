import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse, delay } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, test } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { TodayPage } from './TodayPage';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const activeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const completedId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/workspace/:workspaceId/today" element={<TodayPage />} />
    </Routes>,
    `/workspace/${workspaceId}/today`
  );
}

function todayAt(hour: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0, 0, 0).toISOString();
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

function mockToday(items: ReturnType<typeof makeTodoDto>[]) {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/today`, () =>
      HttpResponse.json({
        items,
        pagination: { limit: 100, hasMore: false, nextCursor: null }
      })
    )
  );
}

describe('TodayPage', () => {
  test('menampilkan skeleton saat tugas hari ini dimuat', async () => {
    mockWorkspace();
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/today`, async () => {
        await delay('infinite');
        return HttpResponse.json({ items: [], pagination: {} });
      })
    );

    renderPage();
    expect(screen.getByLabelText('Memuat tugas hari ini')).toBeInTheDocument();
  });

  test('menampilkan empty state ketika tidak ada tugas hari ini', async () => {
    mockWorkspace();
    mockToday([]);

    renderPage();

    expect(
      await screen.findByRole('heading', { name: "You're all clear for today!" })
    ).toBeInTheDocument();
    expect(screen.getByText(/Tidak ada tugas yang jatuh tempo hari ini/)).toBeInTheDocument();
  });

  test('menampilkan tugas aktif dan selesai hari ini beserta ringkasan', async () => {
    mockWorkspace();
    mockToday([
      makeTodoDto({
        id: activeId,
        title: 'Review desain',
        status: 'todo',
        priority: 'high',
        dueAt: todayAt(20)
      }),
      makeTodoDto({
        id: completedId,
        title: 'Laporan mingguan',
        status: 'completed',
        dueAt: todayAt(9),
        completedAt: todayAt(10)
      })
    ]);

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Jatuh Tempo Hari Ini' })
    ).toBeInTheDocument();
    expect(screen.getByText('Review desain')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Selesai Hari Ini' })).toBeInTheDocument();
    expect(screen.getByText('Laporan mingguan')).toBeInTheDocument();
    expect(screen.getByLabelText('Ringkasan tugas hari ini')).toHaveTextContent('1 aktif');
    expect(screen.getByLabelText('Ringkasan tugas hari ini')).toHaveTextContent('1 selesai');
  });

  test('menandai tugas selesai dan menampilkan feedback', async () => {
    const user = userEvent.setup();
    mockWorkspace();
    mockToday([
      makeTodoDto({
        id: activeId,
        title: 'Review desain',
        status: 'todo',
        dueAt: todayAt(20)
      })
    ]);

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${activeId}/complete`, () =>
        HttpResponse.json({
          todo: makeTodoDto({
            id: activeId,
            title: 'Review desain',
            status: 'completed',
            dueAt: todayAt(20),
            completedAt: todayAt(12)
          })
        })
      )
    );

    renderPage();

    await user.click(
      await screen.findByRole('checkbox', {
        name: 'Tandai tugas Review desain sebagai selesai'
      })
    );

    expect(await screen.findByText('Tugas ditandai selesai.')).toBeInTheDocument();
  });

  test('menampilkan error dan mencoba ulang', async () => {
    mockWorkspace();
    let calls = 0;

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/today`, () => {
        calls += 1;
        return HttpResponse.json(
          {
            error: {
              code: 'INTERNAL_ERROR',
              message: 'Gagal mengambil jadwal hari ini.',
              requestId: 'req-500'
            }
          },
          { status: 500 }
        );
      })
    );

    renderPage();

    expect(
      await screen.findByRole('heading', { name: 'Gagal memuat tugas hari ini' }, { timeout: 4000 })
    ).toBeInTheDocument();
    expect(screen.getByText('Gagal mengambil jadwal hari ini.')).toBeInTheDocument();

    const before = calls;
    await userEvent.setup().click(screen.getByRole('button', { name: 'Coba lagi' }));
    await waitFor(() => expect(calls).toBeGreaterThan(before));
  });
});
