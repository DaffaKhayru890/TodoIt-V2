import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { AppRoutes } from '@/app/router/router';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';

describe('Workspace Workflows (Integration-style)', () => {
  const baseUrl = 'http://localhost:4000';

  test('Workflow A — Pembuatan Workspace Baru hingga Navigasi ke Detail', async () => {
    const user = userEvent.setup();

    // Initial state: 1 workspace
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces`, () => {
        return HttpResponse.json({
          items: [
            {
              id: 'ws-init-1',
              name: 'Workspace Awal',
              description: null,
              role: 'owner',
              createdAt: '2026-11-01T00:00:00.000Z'
            }
          ],
          pagination: { limit: 20, offset: 0, total: 1 }
        });
      }),

      // Create workspace response
      http.post(`${baseUrl}/api/v1/workspaces`, async ({ request }) => {
        const body = (await request.json()) as { name: string; description?: string };
        return HttpResponse.json(
          {
            workspace: {
              id: 'ws-created-999',
              name: body.name,
              description: body.description ?? null,
              role: 'owner',
              createdAt: '2026-11-07T10:00:00.000Z',
              updatedAt: '2026-11-07T10:00:00.000Z',
              archivedAt: null
            }
          },
          { status: 201 }
        );
      }),

      // Detail workspace response
      http.get(`${baseUrl}/api/v1/workspaces/ws-created-999`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-created-999',
            name: 'Workspace Workflow A',
            description: 'Keterangan A',
            role: 'owner',
            createdAt: '2026-11-07T10:00:00.000Z',
            updatedAt: '2026-11-07T10:00:00.000Z',
            archivedAt: null
          }
        });
      })
    );

    renderWithProviders(<AppRoutes />, '/inbox');

    // 1 & 2: App opens and loads list
    expect(await screen.findByRole('link', { name: 'Workspace Awal' })).toBeInTheDocument();

    // 3: Click Add Workspace
    const addBtn = screen.getByRole('button', { name: 'Tambah workspace' });
    await user.click(addBtn);

    // 4: Dialog opens
    expect(screen.getByRole('dialog', { name: 'Buat Workspace Baru' })).toBeInTheDocument();

    // Fill form
    await user.type(screen.getByLabelText(/Nama Workspace/i), 'Workspace Workflow A');
    await user.type(screen.getByLabelText(/Deskripsi/i), 'Keterangan A');

    // 5 & 6: Submit
    const submitBtn = screen.getByRole('button', { name: 'Buat Workspace' });
    await user.click(submitBtn);

    // 7 & 8: Dialog closes, navigates to new workspace detail
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // 9: Detail page loads with header and empty state
    expect(
      await screen.findByRole(
        'heading',
        { level: 1, name: 'Workspace Workflow A' },
        { timeout: 4000 }
      )
    ).toBeInTheDocument();
    expect(await screen.findByText('Belum ada tugas!')).toBeInTheDocument();
  }, 15000);

  test('Workflow B — Pembaruan Workspace dari Halaman Detail', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/ws-edit-1`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-edit-1',
            name: 'Nama Sebelum Edit',
            description: 'Deskripsi sebelum',
            role: 'owner',
            createdAt: '2026-11-01T00:00:00.000Z',
            updatedAt: '2026-11-01T00:00:00.000Z',
            archivedAt: null
          }
        });
      }),

      http.patch(`${baseUrl}/api/v1/workspaces/ws-edit-1`, async ({ request }) => {
        const body = (await request.json()) as { name?: string; description?: string };
        return HttpResponse.json({
          workspace: {
            id: 'ws-edit-1',
            name: body.name ?? 'Nama Sebelum Edit',
            description: body.description ?? null,
            role: 'owner',
            createdAt: '2026-11-01T00:00:00.000Z',
            updatedAt: '2026-11-07T12:00:00.000Z',
            archivedAt: null
          }
        });
      })
    );

    renderWithProviders(<AppRoutes />, '/workspace/ws-edit-1');

    // 1: Open workspace
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nama Sebelum Edit' })
    ).toBeInTheDocument();

    // 2 & 3: Open Edit dialog
    const editBtn = screen.getByRole('button', { name: 'Ubah' });
    await user.click(editBtn);

    expect(screen.getByRole('dialog', { name: 'Ubah Workspace' })).toBeInTheDocument();

    // 4: Update fields
    const nameInput = screen.getByLabelText(/Nama Workspace/i);
    await user.clear(nameInput);
    await user.type(nameInput, 'Nama Setelah Edit');

    // 5: Submit
    await user.click(screen.getByRole('button', { name: 'Simpan Perubahan' }));

    // 6 & 8: Dialog closes and detail updates
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nama Setelah Edit' })
    ).toBeInTheDocument();
  }, 15000);

  test('Workflow C — Pengarsipan Workspace dari Halaman Detail', async () => {
    const user = userEvent.setup();

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/ws-archive-run`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-archive-run',
            name: 'Workspace Yang Hendak Diarsipkan',
            description: null,
            role: 'owner',
            createdAt: '2026-11-01T00:00:00.000Z',
            updatedAt: '2026-11-01T00:00:00.000Z',
            archivedAt: null
          }
        });
      }),

      http.post(`${baseUrl}/api/v1/workspaces/ws-archive-run/archive`, () => {
        return HttpResponse.json({
          workspace: {
            id: 'ws-archive-run',
            archivedAt: '2026-11-07T15:00:00.000Z'
          }
        });
      })
    );

    renderWithProviders(<AppRoutes />, '/workspace/ws-archive-run');

    // 1: Detail loads
    expect(
      await screen.findByRole('heading', {
        level: 1,
        name: 'Workspace Yang Hendak Diarsipkan'
      })
    ).toBeInTheDocument();

    // 2 & 3: Open Archive dialog
    const archiveBtn = screen.getByRole('button', { name: 'Arsipkan' });
    await user.click(archiveBtn);

    expect(screen.getByRole('dialog', { name: 'Arsipkan Workspace' })).toBeInTheDocument();

    // 4: Confirm archive
    const confirmBtn = screen.getByRole('button', { name: 'Ya, Arsipkan' });
    await user.click(confirmBtn);

    // 5 & 7: Dialog closes and navigates to safe route (/inbox)
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    expect(await screen.findByRole('heading', { name: 'Inbox' })).toBeInTheDocument();
  }, 15000);
});
