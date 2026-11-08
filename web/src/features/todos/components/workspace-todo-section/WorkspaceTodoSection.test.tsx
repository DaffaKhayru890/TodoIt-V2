import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { WorkspaceTodoSection } from './WorkspaceTodoSection';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const activeId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const completedId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function renderSection() {
  return renderWithProviders(
    <WorkspaceTodoSection workspaceId={workspaceId} workspaceName="Proyek Alpha" />,
    `/workspace/${workspaceId}`
  );
}

function mockTodoList(items: () => readonly ReturnType<typeof makeTodoDto>[]) {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () => {
      return HttpResponse.json({
        items: items(),
        pagination: { limit: 100, hasMore: false, nextCursor: null }
      });
    })
  );
}

describe('WorkspaceTodoSection', () => {
  test('menampilkan skeleton saat daftar tugas dimuat', () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, async () => {
        return new Promise(() => {});
      })
    );

    renderSection();
    expect(screen.getByLabelText('Memuat daftar tugas')).toBeInTheDocument();
  });

  test('menampilkan empty state ketika workspace belum memiliki tugas', async () => {
    mockTodoList(() => []);

    renderSection();

    expect(await screen.findByText('Belum ada tugas!')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buat tugas pertama' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Tugas' })).toBeInTheDocument();
  });

  test('menampilkan error dan memuat ulang daftar saat Coba lagi ditekan', async () => {
    const user = userEvent.setup();
    let calls = 0;

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () => {
        calls += 1;

        if (calls <= 2) {
          return HttpResponse.json(
            {
              error: {
                code: 'INTERNAL_ERROR',
                message: 'Server sedang bermasalah.',
                requestId: 'req-500'
              }
            },
            { status: 500 }
          );
        }

        return HttpResponse.json({
          items: [makeTodoDto({ id: activeId, workspaceId, title: 'Tugas pulih' })],
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        });
      })
    );

    renderSection();

    expect(await screen.findByRole('heading', { name: 'Gagal memuat tugas' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));

    expect(await screen.findByText('Tugas pulih')).toBeInTheDocument();
    expect(calls).toBeGreaterThanOrEqual(2);
  });

  test('memisahkan tugas aktif dan selesai dari respons backend', async () => {
    mockTodoList(() => [
      makeTodoDto({ id: activeId, workspaceId, title: 'Tugas aktif' }),
      makeTodoDto({
        id: completedId,
        workspaceId,
        title: 'Tugas selesai',
        status: 'completed',
        completedAt: '2026-11-07T12:00:00.000Z'
      })
    ]);

    renderSection();

    const activeSection = await screen.findByLabelText('Daftar tugas aktif');
    expect(within(activeSection).getByText('Tugas aktif')).toBeInTheDocument();

    const completedSection = screen.getByLabelText('Daftar tugas selesai');
    expect(within(completedSection).getByText('Tugas selesai')).toBeInTheDocument();
  });

  test('menandai tugas selesai lewat endpoint complete dan menampilkan feedback', async () => {
    const user = userEvent.setup();
    let completed = false;

    mockTodoList(() => [
      makeTodoDto({
        id: activeId,
        workspaceId,
        title: 'Tugas aktif',
        status: completed ? 'completed' : 'todo',
        completedAt: completed ? '2026-11-07T12:00:00.000Z' : null
      })
    ]);

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${activeId}/complete`, () => {
        completed = true;
        return HttpResponse.json({
          todo: makeTodoDto({
            id: activeId,
            workspaceId,
            title: 'Tugas aktif',
            status: 'completed',
            completedAt: '2026-11-07T12:00:00.000Z'
          })
        });
      })
    );

    renderSection();

    await user.click(await screen.findByRole('checkbox', { name: /Tandai tugas Tugas aktif/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Tugas ditandai selesai.');
    expect(await screen.findByLabelText('Daftar tugas selesai')).toBeInTheDocument();
    expect(completed).toBe(true);
  });

  test('membuka kembali tugas selesai lewat PATCH status todo', async () => {
    const user = userEvent.setup();
    let reopened = false;

    mockTodoList(() => [
      makeTodoDto({
        id: completedId,
        workspaceId,
        title: 'Tugas selesai',
        status: reopened ? 'todo' : 'completed',
        completedAt: reopened ? null : '2026-11-07T12:00:00.000Z'
      })
    ]);

    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${completedId}`,
        async ({ request }) => {
          const body = (await request.json()) as { status: string };
          expect(body).toEqual({ status: 'todo' });
          reopened = true;

          return HttpResponse.json({
            todo: makeTodoDto({
              id: completedId,
              workspaceId,
              title: 'Tugas selesai',
              status: 'todo'
            })
          });
        }
      )
    );

    renderSection();

    await user.click(await screen.findByRole('checkbox', { name: /Buka kembali tugas/i }));

    expect(await screen.findByRole('status')).toHaveTextContent('Tugas berhasil dibuka kembali.');
    expect(reopened).toBe(true);
  });

  test('menampilkan pesan error ketika pembaruan status gagal', async () => {
    const user = userEvent.setup();

    mockTodoList(() => [makeTodoDto({ id: activeId, workspaceId, title: 'Tugas aktif' })]);

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${activeId}/complete`, () => {
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

    renderSection();

    await user.click(await screen.findByRole('checkbox', { name: /Tandai tugas Tugas aktif/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Todo tidak ditemukan.');
  });

  test('membuat tugas baru dari dialog dan menampilkan feedback', async () => {
    const user = userEvent.setup();

    mockTodoList(() => []);

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, async ({ request }) => {
        const body = (await request.json()) as { title: string; description: string | null };

        return HttpResponse.json(
          {
            todo: makeTodoDto({
              id: activeId,
              workspaceId,
              title: body.title,
              description: body.description
            })
          },
          { status: 201 }
        );
      })
    );

    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Buat tugas pertama' }));

    const dialog = screen.getByRole('dialog', { name: 'Buat Tugas Baru' });
    expect(within(dialog).getByText('Proyek Alpha')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText(/Judul Tugas/i), 'Tugas dari dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Buat Tugas' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Tugas berhasil dibuat.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  test('mengubah tugas dari menu aksi dan menampilkan feedback', async () => {
    const user = userEvent.setup();

    mockTodoList(() => [makeTodoDto({ id: activeId, workspaceId, title: 'Judul lama' })]);

    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${activeId}`,
        async ({ request }) => {
          const body = (await request.json()) as { title: string };

          return HttpResponse.json({
            todo: makeTodoDto({ id: activeId, workspaceId, title: body.title })
          });
        }
      )
    );

    renderSection();

    await user.click(await screen.findByRole('button', { name: /Aksi untuk Judul lama/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Ubah' }));

    const dialog = screen.getByRole('dialog', { name: 'Ubah Tugas' });
    const title = within(dialog).getByLabelText(/Judul Tugas/i);
    await user.clear(title);
    await user.type(title, 'Judul baru');
    await user.click(within(dialog).getByRole('button', { name: 'Simpan Perubahan' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Perubahan tugas berhasil disimpan.'
    );
  });

  test('menghapus tugas dari menu aksi dan menampilkan feedback', async () => {
    const user = userEvent.setup();

    mockTodoList(() => [makeTodoDto({ id: activeId, workspaceId, title: 'Tugas untuk dihapus' })]);

    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${activeId}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    renderSection();

    await user.click(
      await screen.findByRole('button', { name: /Aksi untuk Tugas untuk dihapus/i })
    );
    await user.click(screen.getByRole('menuitem', { name: 'Hapus' }));

    const dialog = screen.getByRole('dialog', { name: 'Hapus Tugas' });
    await user.click(within(dialog).getByRole('button', { name: 'Hapus Tugas' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Tugas berhasil dihapus.');
  });

  test('feedback dapat ditutup tanpa mengubah daftar', async () => {
    const user = userEvent.setup();

    mockTodoList(() => []);

    server.use(
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () => {
        return HttpResponse.json(
          { todo: makeTodoDto({ id: activeId, workspaceId, title: 'Tugas singkat' }) },
          { status: 201 }
        );
      })
    );

    renderSection();

    await user.click(await screen.findByRole('button', { name: 'Buat tugas pertama' }));
    const dialog = screen.getByRole('dialog', { name: 'Buat Tugas Baru' });
    await user.type(within(dialog).getByLabelText(/Judul Tugas/i), 'Tugas singkat');
    await user.click(within(dialog).getByRole('button', { name: 'Buat Tugas' }));

    const status = await screen.findByRole('status');
    await user.click(within(status).getByRole('button', { name: 'Tutup notifikasi' }));

    await waitFor(() => {
      expect(screen.queryByRole('status')).not.toBeInTheDocument();
    });
  });
});
