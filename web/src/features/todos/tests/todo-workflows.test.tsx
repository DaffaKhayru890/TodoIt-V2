import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { AppRoutes } from '@/app/router/router';
import type { TodoDto } from '@/features/todos/models/todo.dto';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const workspacePath = `/workspace/${workspaceId}`;

function mockWorkspace() {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}`, () => {
      return HttpResponse.json({
        workspace: {
          id: workspaceId,
          name: 'Workspace Todo',
          description: 'Workspace untuk pengujian alur tugas.',
          role: 'member',
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
          archivedAt: null
        }
      });
    })
  );
}

/**
 * Handler daftar todo yang membaca state lokal agar invalidasi cache setelah
 * mutation benar-benar memuat data terbaru, seperti backend sungguhan.
 */
function mockTodoStore(initial: TodoDto[]) {
  const store = [...initial];

  const handler = http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () => {
    return HttpResponse.json({
      items: store,
      pagination: { limit: 100, hasMore: false, nextCursor: null }
    });
  });

  server.use(handler);

  return store;
}

describe('Todo Workflows (Integration-style)', () => {
  test('Workflow A — Membuat tugas baru dari empty state', async () => {
    const user = userEvent.setup();
    const store = mockTodoStore([]);
    mockWorkspace();

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, async ({ request }) => {
        const body = (await request.json()) as { title: string; description: string | null };
        const created = makeTodoDto({
          id: todoId,
          workspaceId,
          title: body.title,
          description: body.description
        });

        store.push(created);

        return HttpResponse.json({ todo: created }, { status: 201 });
      })
    );

    renderWithProviders(<AppRoutes />, workspacePath);

    expect(await screen.findByText('Belum ada tugas!')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Buat tugas pertama' }));

    const dialog = screen.getByRole('dialog', { name: 'Buat Tugas Baru' });
    await user.type(within(dialog).getByLabelText(/Judul Tugas/i), 'Menulis dokumentasi Phase 4');
    await user.type(
      within(dialog).getByLabelText(/Deskripsi/i),
      'Dokumentasikan kontrak dan alur tugas.'
    );
    await user.click(within(dialog).getByRole('button', { name: 'Buat Tugas' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Tugas berhasil dibuat.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const activeSection = await screen.findByLabelText('Daftar tugas aktif');
    expect(within(activeSection).getByText('Menulis dokumentasi Phase 4')).toBeInTheDocument();
  }, 20000);

  test('Workflow B — Mengubah judul dan deskripsi tugas dari daftar', async () => {
    const user = userEvent.setup();
    const store = mockTodoStore([
      makeTodoDto({ id: todoId, workspaceId, title: 'Judul awal', description: 'Deskripsi awal' })
    ]);
    mockWorkspace();

    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`,
        async ({ request }) => {
          const body = (await request.json()) as { title?: string; description?: string | null };
          const index = store.findIndex((todo) => todo.id === todoId);

          if (index >= 0) {
            store[index] = { ...store[index]!, ...body };
          }

          return HttpResponse.json({ todo: store[index] });
        }
      )
    );

    renderWithProviders(<AppRoutes />, workspacePath);

    await user.click(await screen.findByRole('button', { name: /Aksi untuk Judul awal/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Ubah' }));

    const dialog = screen.getByRole('dialog', { name: 'Ubah Tugas' });
    const title = within(dialog).getByLabelText(/Judul Tugas/i);
    await user.clear(title);
    await user.type(title, 'Judul setelah perubahan');

    const description = within(dialog).getByLabelText(/Deskripsi/i);
    await user.clear(description);
    await user.type(description, 'Deskripsi setelah perubahan');

    await user.click(within(dialog).getByRole('button', { name: 'Simpan Perubahan' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Perubahan tugas berhasil disimpan.'
    );
    expect(await screen.findByText('Judul setelah perubahan')).toBeInTheDocument();
    expect(screen.getByText('Deskripsi setelah perubahan')).toBeInTheDocument();
  }, 20000);

  test('Workflow C — Menyelesaikan lalu membuka kembali tugas', async () => {
    const user = userEvent.setup();
    const store = mockTodoStore([
      makeTodoDto({ id: todoId, workspaceId, title: 'Tugas yang diselesaikan' })
    ]);
    mockWorkspace();

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/complete`, () => {
        const index = store.findIndex((todo) => todo.id === todoId);
        store[index] = {
          ...store[index]!,
          status: 'completed',
          completedAt: '2026-11-07T12:00:00.000Z'
        };

        return HttpResponse.json({ todo: store[index] });
      }),
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`,
        async ({ request }) => {
          const body = (await request.json()) as { status: string };
          expect(body).toEqual({ status: 'todo' });

          const index = store.findIndex((todo) => todo.id === todoId);
          store[index] = { ...store[index]!, status: 'todo', completedAt: null };

          return HttpResponse.json({ todo: store[index] });
        }
      )
    );

    renderWithProviders(<AppRoutes />, workspacePath);

    await user.click(
      await screen.findByRole('checkbox', { name: /Tandai tugas Tugas yang diselesaikan/i })
    );

    expect(await screen.findByRole('status')).toHaveTextContent('Tugas ditandai selesai.');

    const completedSection = await screen.findByLabelText('Daftar tugas selesai');
    expect(within(completedSection).getByText('Tugas yang diselesaikan')).toBeInTheDocument();

    await user.click(
      within(completedSection).getByRole('checkbox', {
        name: /Buka kembali tugas Tugas yang diselesaikan/i
      })
    );

    expect(await screen.findByRole('status')).toHaveTextContent('Tugas berhasil dibuka kembali.');

    await waitFor(() => {
      const activeSection = screen.getByLabelText('Daftar tugas aktif');
      expect(within(activeSection).getByText('Tugas yang diselesaikan')).toBeInTheDocument();
    });
  }, 20000);

  test('Workflow D — Melihat detail lalu menghapus tugas dan kembali ke workspace', async () => {
    const user = userEvent.setup();
    const store = mockTodoStore([
      makeTodoDto({ id: todoId, workspaceId, title: 'Tugas untuk dihapus' })
    ]);
    mockWorkspace();

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        return HttpResponse.json({ todo: store[0] });
      }),
      http.delete(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        store.splice(0, store.length);
        return new HttpResponse(null, { status: 204 });
      })
    );

    renderWithProviders(<AppRoutes />, workspacePath);

    await user.click(
      await screen.findByRole('link', { name: /Buka detail tugas Tugas untuk dihapus/i })
    );

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Tugas untuk dihapus' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Hapus' }));

    const dialog = screen.getByRole('dialog', { name: 'Hapus Tugas' });
    await user.click(within(dialog).getByRole('button', { name: 'Hapus Tugas' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Workspace Todo' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Belum ada tugas!')).toBeInTheDocument();
  }, 20000);

  test('Workflow E — Detail tugas tidak ditemukan dan kembali ke workspace', async () => {
    const user = userEvent.setup();
    mockTodoStore([]);
    mockWorkspace();

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'TODO_NOT_FOUND',
              message: 'Todo tidak ditemukan.',
              requestId: 'req-404'
            }
          },
          { status: 404 }
        );
      })
    );

    renderWithProviders(<AppRoutes />, `/workspace/${workspaceId}/todos/${todoId}`);

    expect(
      await screen.findByRole('heading', { name: 'Tugas tidak ditemukan' })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Kembali ke workspace' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Workspace Todo' })
    ).toBeInTheDocument();
    expect(await screen.findByText('Belum ada tugas!')).toBeInTheDocument();
  }, 20000);
});
