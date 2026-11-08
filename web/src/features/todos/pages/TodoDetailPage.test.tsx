import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { Route, Routes } from 'react-router';
import { describe, expect, test } from 'vitest';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';
import { TodoDetailPage } from './TodoDetailPage';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/workspace/:workspaceId" element={<div>Halaman Workspace</div>} />
      <Route path="/workspace/:workspaceId/todos/:todoId" element={<TodoDetailPage />} />
    </Routes>,
    `/workspace/${workspaceId}/todos/${todoId}`
  );
}

function mockWorkspace() {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}`, () => {
      return HttpResponse.json({
        workspace: {
          id: workspaceId,
          name: 'Proyek Alpha',
          description: null,
          role: 'owner',
          createdAt: '2026-11-01T00:00:00.000Z',
          updatedAt: '2026-11-01T00:00:00.000Z',
          archivedAt: null
        }
      });
    })
  );
}

function mockTodo(overrides: Parameters<typeof makeTodoDto>[0] = {}) {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
      return HttpResponse.json({
        todo: makeTodoDto({ id: todoId, workspaceId, ...overrides })
      });
    })
  );
}

describe('TodoDetailPage', () => {
  test('menampilkan skeleton saat detail tugas dimuat', () => {
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, async () => {
        return new Promise(() => {});
      })
    );

    renderDetail();
    expect(screen.getByLabelText('Memuat detail tugas')).toBeInTheDocument();
  });

  test('menampilkan detail tugas lengkap dengan workspace dan informasi', async () => {
    mockWorkspace();
    mockTodo({
      title: 'Merancang halaman detail',
      description: 'Tentukan struktur konten.',
      createdAt: '2026-11-07T09:00:00.000Z',
      updatedAt: '2026-11-07T10:30:00.000Z'
    });

    renderDetail();

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Merancang halaman detail' })
    ).toBeInTheDocument();
    expect(screen.getByText('Tentukan struktur konten.')).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Proyek Alpha' })).toBeInTheDocument();
    expect(screen.getByText('Aktif')).toBeInTheDocument();
    expect(screen.getByText(workspaceId)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Tandai Selesai' })).toBeInTheDocument();
  });

  test('menampilkan status tidak ditemukan untuk error 404', async () => {
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

    renderDetail();

    expect(
      await screen.findByRole('heading', { name: 'Tugas tidak ditemukan' })
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        'Tugas ini tidak ada, sudah dihapus, atau bukan bagian dari workspace yang Anda buka.'
      )
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Kembali ke workspace' })).toBeInTheDocument();
  });

  test('menampilkan akses ditolak untuk error 403', async () => {
    mockWorkspace();
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        return HttpResponse.json(
          {
            error: {
              code: 'WORKSPACE_PERMISSION_DENIED',
              message: 'Role Anda tidak memiliki izin.',
              requestId: 'req-403'
            }
          },
          { status: 403 }
        );
      })
    );

    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Akses ditolak' })).toBeInTheDocument();
    expect(
      screen.getByText('Anda tidak memiliki hak untuk melihat tugas ini.')
    ).toBeInTheDocument();
  });

  test('menolak todo yang berasal dari workspace lain', async () => {
    mockWorkspace();
    mockTodo({ workspaceId: '22222222-2222-4222-8222-222222222222' });

    renderDetail();

    expect(
      await screen.findByRole('heading', { name: 'Tugas tidak ditemukan' })
    ).toBeInTheDocument();
    expect(
      screen.getByText('Tugas ini bukan bagian dari workspace yang Anda buka.')
    ).toBeInTheDocument();
  });

  test('menandai tugas selesai dan menampilkan completedAt', async () => {
    const user = userEvent.setup();

    mockWorkspace();

    let completed = false;

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
        return HttpResponse.json({
          todo: makeTodoDto({
            id: todoId,
            workspaceId,
            title: 'Tugas detail',
            status: completed ? 'completed' : 'todo',
            completedAt: completed ? '2026-11-07T12:00:00.000Z' : null
          })
        });
      }),
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/complete`, () => {
        completed = true;
        return HttpResponse.json({
          todo: makeTodoDto({
            id: todoId,
            workspaceId,
            title: 'Tugas detail',
            status: 'completed',
            completedAt: '2026-11-07T12:00:00.000Z'
          })
        });
      })
    );

    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Tandai Selesai' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Tugas ditandai selesai.');
    expect(await screen.findByText('Selesai')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Buka Kembali' })).toBeInTheDocument();
  });

  test('membuka kembali tugas selesai', async () => {
    const user = userEvent.setup();

    mockWorkspace();
    mockTodo({
      title: 'Tugas selesai',
      status: 'completed',
      completedAt: '2026-11-07T12:00:00.000Z'
    });

    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`,
        async ({ request }) => {
          const body = (await request.json()) as { status: string };
          expect(body).toEqual({ status: 'todo' });

          return HttpResponse.json({
            todo: makeTodoDto({ id: todoId, workspaceId, title: 'Tugas selesai', status: 'todo' })
          });
        }
      )
    );

    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Buka Kembali' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Tugas berhasil dibuka kembali.');
  });

  test('menampilkan error ketika pembaruan status gagal', async () => {
    const user = userEvent.setup();

    mockWorkspace();
    mockTodo({ title: 'Tugas detail' });

    server.use(
      http.patch(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/complete`, () => {
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

    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Tandai Selesai' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Todo tidak ditemukan.');
  });

  test('mengubah tugas dari halaman detail dan menampilkan feedback', async () => {
    const user = userEvent.setup();

    mockWorkspace();
    mockTodo({ title: 'Judul lama', description: null });

    server.use(
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`,
        async ({ request }) => {
          const body = (await request.json()) as { title: string };

          return HttpResponse.json({
            todo: makeTodoDto({
              id: todoId,
              workspaceId,
              title: body.title,
              description: null
            })
          });
        }
      )
    );

    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Ubah' }));

    const dialog = screen.getByRole('dialog', { name: 'Ubah Tugas' });
    const title = within(dialog).getByLabelText(/Judul Tugas/i);
    await user.clear(title);
    await user.type(title, 'Judul baru');
    await user.click(within(dialog).getByRole('button', { name: 'Simpan Perubahan' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Perubahan "Judul baru" berhasil disimpan.'
    );
  });

  test('menghapus tugas lalu kembali ke halaman workspace', async () => {
    const user = userEvent.setup();

    mockWorkspace();
    mockTodo({ title: 'Tugas akan dihapus' });

    server.use(
      http.delete(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`,
        () => new HttpResponse(null, { status: 204 })
      )
    );

    renderDetail();

    await user.click(await screen.findByRole('button', { name: 'Hapus' }));

    const dialog = screen.getByRole('dialog', { name: 'Hapus Tugas' });
    await user.click(within(dialog).getByRole('button', { name: 'Hapus Tugas' }));

    expect(await screen.findByText('Halaman Workspace')).toBeInTheDocument();
  });

  test('menampilkan error umum dan dapat memuat ulang', async () => {
    const user = userEvent.setup();
    let calls = 0;

    mockWorkspace();

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`, () => {
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
          todo: makeTodoDto({ id: todoId, workspaceId, title: 'Tugas pulih' })
        });
      })
    );

    renderDetail();

    expect(await screen.findByRole('heading', { name: 'Gagal memuat tugas' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Coba lagi' }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Tugas pulih' })).toBeInTheDocument();
    });
  });
});
