import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { AppRoutes } from '@/app/router/router';
import type { ReminderDto } from '@/features/reminders/models/reminder.dto';
import type { TagDto } from '@/features/tags/models/tag.dto';
import type { TodoDto } from '@/features/todos/models/todo.dto';
import { makeLabelDto } from '@/test/fixtures/labels';
import { makeReminderDto } from '@/test/fixtures/reminders';
import { makeTagDto } from '@/test/fixtures/tags';
import { makeTodoDto } from '@/test/fixtures/todos';
import { server } from '@/test/mocks/server';
import { renderWithProviders } from '@/test/utils/render-with-providers';

const baseUrl = 'http://localhost:4000';
const workspaceId = '11111111-1111-4111-8111-111111111111';
const workspacePath = `/workspace/${workspaceId}`;

const backendTag = makeTagDto({
  id: 'a1111111-1111-4111-8111-111111111111',
  name: 'backend'
});
const designTag = makeTagDto({
  id: 'a2222222-2222-4222-8222-222222222222',
  name: 'design'
});
const bugLabel = makeLabelDto({
  id: 'b1111111-1111-4111-8111-111111111111',
  name: 'Bug',
  color: '#E74C3C'
});
const featureLabel = makeLabelDto({
  id: 'b2222222-2222-4222-8222-222222222222',
  name: 'Feature',
  color: '#27AE60'
});

function mockWorkspace() {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}`, () =>
      HttpResponse.json({
        workspace: {
          id: workspaceId,
          name: 'Workspace Produktivitas',
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

function mockCatalog(tags: readonly TagDto[] = [backendTag, designTag]) {
  server.use(
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/tags`, () =>
      HttpResponse.json({
        items: tags,
        pagination: { limit: 100, hasMore: false, nextCursor: null }
      })
    ),
    http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/labels`, () =>
      HttpResponse.json({
        items: [bugLabel, featureLabel],
        pagination: { limit: 100, hasMore: false, nextCursor: null }
      })
    )
  );
}

function todoTags(ids: readonly string[], tags: readonly TagDto[] = [backendTag, designTag]) {
  return tags.filter((tag) => ids.includes(tag.id)).map((tag) => ({ id: tag.id, name: tag.name }));
}

function activeItems() {
  return screen.getByLabelText('Daftar tugas aktif');
}

function activeTitles(): (string | null)[] {
  return within(activeItems())
    .getAllByRole('heading', { level: 3 })
    .map((heading) => heading.textContent);
}

describe('Productivity Workflows (Integration-style)', () => {
  test('Workflow A — Membuat tugas lengkap dengan metadata', async () => {
    const user = userEvent.setup();
    const createdId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const store: TodoDto[] = [];
    const dueInput = '2030-01-15T09:00';
    const dueIso = new Date(2030, 0, 15, 9, 0, 0, 0).toISOString();

    let createBody: Record<string, unknown> | undefined;
    let tagsBody: Record<string, unknown> | undefined;
    let labelBody: Record<string, unknown> | undefined;
    let reminderBody: Record<string, unknown> | undefined;

    mockWorkspace();
    mockCatalog();

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () =>
        HttpResponse.json({
          items: store,
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        })
      ),
      http.post(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, async ({ request }) => {
        createBody = (await request.json()) as Record<string, unknown>;
        const body = createBody as {
          title: string;
          description: string | null;
          priority?: string;
          dueAt?: string | null;
        };

        const created = makeTodoDto({
          id: createdId,
          workspaceId,
          title: body.title,
          description: body.description,
          priority: body.priority ?? 'low',
          dueAt: body.dueAt ?? null
        });

        store.push(created);
        return HttpResponse.json({ todo: created }, { status: 201 });
      }),
      http.put(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${createdId}/tags`,
        async ({ request }) => {
          tagsBody = (await request.json()) as Record<string, unknown>;
          const tagIds = (tagsBody as { tagIds: string[] }).tagIds;
          store[0] = { ...store[0]!, tags: todoTags(tagIds) };
          return HttpResponse.json({ tags: store[0]!.tags });
        }
      ),
      http.put(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${createdId}/label`,
        async ({ request }) => {
          labelBody = (await request.json()) as Record<string, unknown>;
          const labelId = (labelBody as { labelId: string }).labelId;
          const label = [bugLabel, featureLabel].find((item) => item.id === labelId) ?? null;
          store[0] = {
            ...store[0]!,
            label: label ? { id: label.id, name: label.name, color: label.color } : null
          };
          return HttpResponse.json({ todo: store[0] });
        }
      ),
      http.post(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${createdId}/reminders`,
        async ({ request }) => {
          reminderBody = (await request.json()) as Record<string, unknown>;
          return HttpResponse.json(
            { reminder: makeReminderDto({ todoId: createdId }) },
            { status: 201 }
          );
        }
      )
    );

    renderWithProviders(<AppRoutes />, workspacePath);

    await user.click(await screen.findByRole('button', { name: 'Buat tugas pertama' }));

    const dialog = screen.getByRole('dialog', { name: 'Buat Tugas Baru' });
    await user.type(within(dialog).getByLabelText(/Judul Tugas/i), 'Rilis fitur produktivitas');

    await user.click(await within(dialog).findByRole('checkbox', { name: 'backend' }));
    await user.selectOptions(within(dialog).getByLabelText('Label'), bugLabel.id);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Prioritas' }), 'high');
    fireEvent.change(within(dialog).getByLabelText('Tenggat Waktu'), {
      target: { value: dueInput }
    });
    await user.click(within(dialog).getByRole('checkbox', { name: 'Aktifkan pengingat' }));
    await user.click(within(dialog).getByRole('button', { name: 'Buat Tugas' }));

    expect(await screen.findByRole('status')).toHaveTextContent('Tugas berhasil dibuat.');

    expect(createBody).toEqual({
      title: 'Rilis fitur produktivitas',
      description: null,
      priority: 'high',
      dueAt: dueIso
    });
    expect(tagsBody).toEqual({ tagIds: [backendTag.id] });
    expect(labelBody).toEqual({ labelId: bugLabel.id });
    expect(reminderBody).toEqual({ triggerType: 'before_due', offsetMinutes: 15 });

    await waitFor(() => {
      const list = activeItems();
      expect(within(list).getByText('Rilis fitur produktivitas')).toBeInTheDocument();
      expect(within(list).getByText('Tinggi')).toBeInTheDocument();
      expect(within(list).getByText('backend')).toBeInTheDocument();
      expect(within(list).getByText('Bug')).toBeInTheDocument();
      expect(within(list).getByText(/Tenggat:/)).toBeInTheDocument();
    });
  }, 30_000);

  test('Workflow B — Mengubah seluruh metadata tugas', async () => {
    const user = userEvent.setup();
    const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
    const reminderId = 'c1111111-1111-4111-8111-111111111111';
    const initialDue = new Date(2030, 0, 10, 9, 0, 0, 0);
    const nextDueInput = '2030-02-20T10:00';
    const nextDueIso = new Date(2030, 1, 20, 10, 0, 0, 0).toISOString();

    const store: TodoDto[] = [
      makeTodoDto({
        id: todoId,
        workspaceId,
        title: 'Tugas metadata',
        status: 'todo',
        priority: 'low',
        dueAt: initialDue.toISOString(),
        label: { id: bugLabel.id, name: bugLabel.name, color: bugLabel.color },
        tags: todoTags([backendTag.id])
      })
    ];
    const reminders: ReminderDto[] = [
      makeReminderDto({ id: reminderId, todoId, offsetMinutes: 15 })
    ];

    let patchBody: Record<string, unknown> | undefined;
    let tagsBody: Record<string, unknown> | undefined;
    let reminderPatchBody: Record<string, unknown> | undefined;

    mockWorkspace();
    mockCatalog();

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () =>
        HttpResponse.json({
          items: store,
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        })
      ),
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders`, () =>
        HttpResponse.json({
          items: reminders,
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        })
      ),
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}`,
        async ({ request }) => {
          patchBody = (await request.json()) as Record<string, unknown>;
          const body = patchBody as {
            priority?: string;
            dueAt?: string | null;
            labelId?: string | null;
          };
          const label =
            body.labelId === undefined
              ? store[0]!.label
              : ([bugLabel, featureLabel].find((item) => item.id === body.labelId) ?? null);

          store[0] = {
            ...store[0]!,
            priority: body.priority ?? store[0]!.priority,
            dueAt: body.dueAt === undefined ? store[0]!.dueAt : body.dueAt,
            label: label ? { id: label.id, name: label.name, color: label.color } : null
          };

          return HttpResponse.json({ todo: store[0] });
        }
      ),
      http.put(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/tags`,
        async ({ request }) => {
          tagsBody = (await request.json()) as Record<string, unknown>;
          const tagIds = (tagsBody as { tagIds: string[] }).tagIds;
          store[0] = { ...store[0]!, tags: todoTags(tagIds) };
          return HttpResponse.json({ tags: store[0]!.tags });
        }
      ),
      http.patch(
        `${baseUrl}/api/v1/workspaces/${workspaceId}/todos/${todoId}/reminders/${reminderId}`,
        async ({ request }) => {
          reminderPatchBody = (await request.json()) as Record<string, unknown>;
          const offsetMinutes = (reminderPatchBody as { offsetMinutes: number }).offsetMinutes;
          reminders[0] = { ...reminders[0]!, offsetMinutes };
          return HttpResponse.json({ reminder: reminders[0] });
        }
      )
    );

    renderWithProviders(<AppRoutes />, workspacePath);

    await user.click(await screen.findByRole('button', { name: /Aksi untuk Tugas metadata/i }));
    await user.click(screen.getByRole('menuitem', { name: 'Ubah' }));

    const dialog = screen.getByRole('dialog', { name: 'Ubah Tugas' });

    await waitFor(() => expect(within(dialog).getByLabelText('Waktu pengingat')).toHaveValue('15'));

    await user.click(within(dialog).getByRole('checkbox', { name: 'backend' }));
    await user.click(within(dialog).getByRole('checkbox', { name: 'design' }));
    await user.selectOptions(within(dialog).getByLabelText('Label'), featureLabel.id);
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Prioritas' }), 'high');
    fireEvent.change(within(dialog).getByLabelText('Tenggat Waktu'), {
      target: { value: nextDueInput }
    });
    await user.selectOptions(within(dialog).getByLabelText('Waktu pengingat'), '60');
    await user.click(within(dialog).getByRole('button', { name: 'Simpan Perubahan' }));

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Perubahan tugas berhasil disimpan.'
    );

    expect(patchBody).toEqual({
      priority: 'high',
      dueAt: nextDueIso,
      labelId: featureLabel.id
    });
    expect(tagsBody).toEqual({ tagIds: [designTag.id] });
    expect(reminderPatchBody).toEqual({ offsetMinutes: 60 });

    await waitFor(() => {
      const list = activeItems();
      expect(within(list).getByText('Tugas metadata')).toBeInTheDocument();
      expect(within(list).getByText('Tinggi')).toBeInTheDocument();
      expect(within(list).getByText('design')).toBeInTheDocument();
      expect(within(list).getByText('Feature')).toBeInTheDocument();
    });
  }, 30_000);

  test('Workflow C — Today menampilkan tugas hari ini menurut timezone lokal', async () => {
    const todayTodo = makeTodoDto({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      workspaceId,
      title: 'Tugas hari ini',
      status: 'todo',
      dueAt: new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate(),
        10,
        0,
        0,
        0
      ).toISOString()
    });
    const completedToday = makeTodoDto({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      workspaceId,
      title: 'Selesai hari ini',
      status: 'completed',
      dueAt: todayTodo.dueAt,
      completedAt: todayTodo.dueAt
    });

    let requestParams: URLSearchParams | undefined;

    mockWorkspace();
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/today`, ({ request }) => {
        requestParams = new URL(request.url).searchParams;
        return HttpResponse.json({
          items: [todayTodo, completedToday],
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        });
      })
    );

    renderWithProviders(<AppRoutes />, `${workspacePath}/today`);

    expect(await screen.findByRole('heading', { name: 'Today' })).toBeInTheDocument();
    expect(await screen.findByText('Tugas hari ini')).toBeInTheDocument();
    expect(screen.getByText('Selesai hari ini')).toBeInTheDocument();
    expect(screen.getByLabelText('Ringkasan tugas hari ini')).toHaveTextContent('1 aktif');

    expect(requestParams?.get('includeCompleted')).toBe('true');
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (timezone) {
      expect(requestParams?.get('timezone')).toBe(timezone);
    }
  }, 30_000);

  test('Workflow D — Upcoming mengelompokkan tanggal dan mengecualikan tanpa tenggat', async () => {
    const tomorrow = makeTodoDto({
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      workspaceId,
      title: 'Rapat besok',
      dueAt: new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate() + 1,
        9
      ).toISOString()
    });
    const later = makeTodoDto({
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      workspaceId,
      title: 'Presentasi tiga hari lagi',
      dueAt: new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate() + 3,
        9
      ).toISOString()
    });
    const withoutDue = makeTodoDto({
      id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      workspaceId,
      title: 'Tanpa tenggat',
      dueAt: null
    });

    let requestParams: URLSearchParams | undefined;

    mockWorkspace();
    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos/upcoming`, ({ request }) => {
        requestParams = new URL(request.url).searchParams;
        return HttpResponse.json({
          items: [tomorrow, later, withoutDue],
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        });
      })
    );

    renderWithProviders(<AppRoutes />, `${workspacePath}/upcoming`);

    expect(await screen.findByRole('heading', { name: 'Upcoming' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Besok' })).toBeInTheDocument();
    expect(screen.getByText('Rapat besok')).toBeInTheDocument();
    expect(screen.getByText('Presentasi tiga hari lagi')).toBeInTheDocument();
    expect(screen.queryByText('Tanpa tenggat')).not.toBeInTheDocument();

    expect(requestParams?.get('days')).toBe('30');
  }, 30_000);

  test('Workflow E — Filter gabungan, hapus satu filter, lalu hapus semua', async () => {
    const user = userEvent.setup();
    const now = new Date();
    const todayAt = (hour: number) =>
      new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour).toISOString();
    const dayAt = (days: number, hour = 9) =>
      new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, hour).toISOString();

    const store: TodoDto[] = [
      makeTodoDto({
        id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        workspaceId,
        title: 'Alpha',
        status: 'todo',
        priority: 'high',
        dueAt: todayAt(9),
        tags: todoTags([backendTag.id]),
        label: { id: bugLabel.id, name: bugLabel.name, color: bugLabel.color }
      }),
      makeTodoDto({
        id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        workspaceId,
        title: 'Beta',
        status: 'todo',
        priority: 'low',
        dueAt: dayAt(3),
        tags: todoTags([designTag.id]),
        label: { id: featureLabel.id, name: featureLabel.name, color: featureLabel.color }
      }),
      makeTodoDto({
        id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        workspaceId,
        title: 'Gamma',
        status: 'completed',
        priority: 'high',
        dueAt: null,
        completedAt: todayAt(8),
        tags: todoTags([backendTag.id])
      }),
      makeTodoDto({
        id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        workspaceId,
        title: 'Delta',
        status: 'todo',
        priority: 'urgent',
        dueAt: dayAt(-1),
        label: { id: bugLabel.id, name: bugLabel.name, color: bugLabel.color }
      }),
      makeTodoDto({
        id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        workspaceId,
        title: 'Epsilon',
        status: 'todo',
        priority: 'low',
        dueAt: todayAt(11),
        tags: todoTags([backendTag.id])
      })
    ];

    mockWorkspace();
    mockCatalog();

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, ({ request }) => {
        const params = new URL(request.url).searchParams;
        const status = params.get('status');
        const priority = params.get('priority');
        const tagIds = params.getAll('tagIds');
        const labelId = params.get('labelId');
        const dueFrom = params.get('dueFrom');
        const dueTo = params.get('dueTo');

        const items = store.filter((todo) => {
          if (status && todo.status !== status) return false;
          if (priority && todo.priority !== priority) return false;
          if (tagIds.length > 0 && !todo.tags.some((tag) => tagIds.includes(tag.id))) {
            return false;
          }
          if (labelId && todo.label?.id !== labelId) return false;

          if (dueFrom) {
            if (!todo.dueAt || new Date(todo.dueAt).getTime() < Date.parse(dueFrom)) {
              return false;
            }
          }

          if (dueTo) {
            if (!todo.dueAt || new Date(todo.dueAt).getTime() > Date.parse(dueTo)) {
              return false;
            }
          }

          return true;
        });

        return HttpResponse.json({
          items,
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        });
      })
    );

    renderWithProviders(<AppRoutes />, workspacePath);

    await waitFor(() => expect(activeTitles()).toEqual(['Alpha', 'Beta', 'Delta', 'Epsilon']));

    await user.click(screen.getByRole('button', { name: 'Filter' }));
    const panel = screen.getByLabelText('Panel filter tugas');

    await user.selectOptions(within(panel).getByLabelText('Filter status'), 'active');
    await user.selectOptions(within(panel).getByLabelText('Filter prioritas'), 'high');
    await user.click(within(panel).getByRole('checkbox', { name: 'backend' }));
    await user.selectOptions(within(panel).getByLabelText('Filter tenggat'), 'today');

    await waitFor(() => {
      const list = activeItems();
      expect(within(list).getByText('Alpha')).toBeInTheDocument();
      expect(within(list).queryByText('Beta')).not.toBeInTheDocument();
      expect(within(list).queryByText('Delta')).not.toBeInTheDocument();
      expect(within(list).queryByText('Epsilon')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Hapus filter Prioritas: Tinggi' }));

    await waitFor(() => {
      const list = activeItems();
      expect(within(list).getByText('Alpha')).toBeInTheDocument();
      expect(within(list).getByText('Epsilon')).toBeInTheDocument();
      expect(within(list).queryByText('Beta')).not.toBeInTheDocument();
      expect(within(list).queryByText('Delta')).not.toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /^Filter/ }));
    await user.click(
      within(screen.getByLabelText('Panel filter tugas')).getByRole('button', {
        name: 'Hapus semua'
      })
    );

    await waitFor(() => {
      const list = activeItems();
      expect(within(list).getByText('Alpha')).toBeInTheDocument();
      expect(within(list).getByText('Beta')).toBeInTheDocument();
      expect(within(list).getByText('Delta')).toBeInTheDocument();
      expect(within(list).getByText('Epsilon')).toBeInTheDocument();
    });

    const completed = screen.getByLabelText('Daftar tugas selesai');
    expect(within(completed).getByText('Gamma')).toBeInTheDocument();
  }, 30_000);

  test('Workflow F — Sorting natural, arah, prioritas, dan tenggat', async () => {
    const user = userEvent.setup();
    const store: TodoDto[] = [
      makeTodoDto({
        id: '11111111-1111-4111-8111-111111111111',
        workspaceId,
        title: 'Task 1',
        priority: 'medium',
        dueAt: new Date(2030, 0, 10, 9).toISOString(),
        createdAt: '2026-11-01T00:00:00.000Z'
      }),
      makeTodoDto({
        id: '22222222-2222-4222-8222-222222222222',
        workspaceId,
        title: 'Task 2',
        priority: 'low',
        dueAt: null,
        createdAt: '2026-11-02T00:00:00.000Z'
      }),
      makeTodoDto({
        id: '33333333-3333-4333-8333-333333333333',
        workspaceId,
        title: 'Task 10',
        priority: 'urgent',
        dueAt: new Date(2030, 0, 5, 9).toISOString(),
        createdAt: '2026-11-03T00:00:00.000Z'
      }),
      makeTodoDto({
        id: '44444444-4444-4444-8444-444444444444',
        workspaceId,
        title: 'Task 3',
        priority: 'high',
        dueAt: new Date(2030, 0, 20, 9).toISOString(),
        createdAt: '2026-11-04T00:00:00.000Z'
      })
    ];

    mockWorkspace();
    mockCatalog();

    server.use(
      http.get(`${baseUrl}/api/v1/workspaces/${workspaceId}/todos`, () =>
        HttpResponse.json({
          items: store,
          pagination: { limit: 100, hasMore: false, nextCursor: null }
        })
      )
    );

    renderWithProviders(<AppRoutes />, workspacePath);

    await waitFor(() => expect(activeTitles()).toHaveLength(4));

    const sortSelect = screen.getByLabelText('Urutkan');
    const directionButton = screen.getByRole('button', { name: /Arah pengurutan/ });

    await user.selectOptions(sortSelect, 'title');
    expect(directionButton).toHaveAccessibleName('Arah pengurutan: Turun. Klik untuk mengubah.');
    await waitFor(() => expect(activeTitles()).toEqual(['Task 10', 'Task 3', 'Task 2', 'Task 1']));

    await user.click(directionButton);
    await waitFor(() => expect(activeTitles()).toEqual(['Task 1', 'Task 2', 'Task 3', 'Task 10']));

    await user.selectOptions(sortSelect, 'priority');
    await waitFor(() => expect(activeTitles()).toEqual(['Task 2', 'Task 1', 'Task 3', 'Task 10']));

    await user.selectOptions(sortSelect, 'dueDate');
    await waitFor(() => expect(activeTitles()).toEqual(['Task 10', 'Task 1', 'Task 3', 'Task 2']));
  }, 30_000);
});
