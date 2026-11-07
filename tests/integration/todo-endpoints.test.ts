import { describe, expect, test } from 'bun:test';
import {
  createTodoTestApp,
  createAuthenticatedUser,
  createWorkspaceForUser,
  authHeader,
  jsonHeaders,
  type TodoTestApp
} from '../helpers/todo-test-app';

type JsonBody = any;

interface TestContext {
  readonly fixture: TodoTestApp;
  readonly app: TodoTestApp['app'];
  readonly clock: TodoTestApp['clock'];
  readonly userId: string;
  readonly token: string;
  readonly workspaceId: string;
  readonly todoPath: string;
}

async function setup(): Promise<TestContext> {
  const fixture = createTodoTestApp();
  const { userId, token } = await createAuthenticatedUser(
    fixture.authRepo,
    fixture.accessTokenService,
    `todo_${crypto.randomUUID()}@example.com`
  );
  const workspace = await createWorkspaceForUser(fixture.workspaceRepo, userId);
  const todoPath = `http://test.local/api/v1/workspaces/${workspace.id}/todos`;

  return {
    fixture,
    app: fixture.app,
    clock: fixture.clock,
    userId,
    token,
    workspaceId: workspace.id,
    todoPath
  };
}

function post(path: string, token: string, body: unknown): Request {
  return new Request(path, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(body)
  });
}

function patch(path: string, token: string, body?: unknown): Request {
  return new Request(path, {
    method: 'PATCH',
    headers: jsonHeaders(token),
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });
}

async function createTodo(
  context: TestContext,
  body: Record<string, unknown> = { title: 'Belajar PostgreSQL' }
): Promise<JsonBody> {
  const response = await context.app.handle(post(context.todoPath, context.token, body));

  expect(response.status).toBe(201);

  return ((await response.json()) as JsonBody).todo;
}

describe('Todo endpoints — authentication dan authorization', () => {
  test('menolak request tanpa access token', async () => {
    const context = await setup();
    const response = await context.app.handle(new Request(context.todoPath));

    expect(response.status).toBe(401);
    const body = (await response.json()) as JsonBody;
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  test('menolak user yang bukan member workspace dengan 404', async () => {
    const context = await setup();
    const outsider = await createAuthenticatedUser(
      context.fixture.authRepo,
      context.fixture.accessTokenService,
      `outsider_${crypto.randomUUID()}@example.com`
    );

    const response = await context.app.handle(
      new Request(context.todoPath, { headers: authHeader(outsider.token) })
    );

    expect(response.status).toBe(404);
    const body = (await response.json()) as JsonBody;
    expect(body.error.code).toBe('WORKSPACE_ACCESS_DENIED');
  });

  test('cross-workspace read/update/delete tidak membocorkan todo', async () => {
    const context = await setup();
    const other = createTodoTestApp();
    const otherUser = await createAuthenticatedUser(
      other.authRepo,
      other.accessTokenService,
      `other_${crypto.randomUUID()}@example.com`
    );
    const otherWorkspace = await createWorkspaceForUser(other.workspaceRepo, otherUser.userId);
    const otherTodoResponse = await other.app.handle(
      post(`http://test.local/api/v1/workspaces/${otherWorkspace.id}/todos`, otherUser.token, {
        title: 'Milik orang lain'
      })
    );
    const otherTodo = ((await otherTodoResponse.json()) as JsonBody).todo;

    const getResponse = await context.app.handle(
      new Request(`${context.todoPath}/${otherTodo.id}`, { headers: authHeader(context.token) })
    );
    expect(getResponse.status).toBe(404);

    const patchResponse = await context.app.handle(
      patch(`${context.todoPath}/${otherTodo.id}`, context.token, { title: 'Hijack' })
    );
    expect(patchResponse.status).toBe(404);

    // Delete bersifat idempotent: id yang tidak ada di workspace sendiri tetap 204
    // dan tidak boleh mengubah todo milik workspace lain.
    const deleteResponse = await context.app.handle(
      new Request(`${context.todoPath}/${otherTodo.id}`, {
        method: 'DELETE',
        headers: authHeader(context.token)
      })
    );
    expect(deleteResponse.status).toBe(204);

    const stillExists = await other.app.handle(
      new Request(`http://test.local/api/v1/workspaces/${otherWorkspace.id}/todos/${otherTodo.id}`, {
        headers: authHeader(otherUser.token)
      })
    );
    expect(stillExists.status).toBe(200);
  });
});

describe('Todo endpoints — CRUD', () => {
  test('create -> list -> detail -> update -> complete -> delete', async () => {
    const context = await setup();
    const created = await createTodo(context, {
      title: '  Learn PostgreSQL  ',
      description: 'Database indexing and transactions',
      priority: 'high',
      dueAt: '2026-11-10T09:00:00+07:00'
    });

    expect(created.id).toBeString();
    expect(created.workspaceId).toBe(context.workspaceId);
    expect(created.title).toBe('Learn PostgreSQL');
    expect(created.status).toBe('todo');
    expect(created.priority).toBe('high');
    expect(created.dueAt).toBe('2026-11-10T02:00:00.000Z');
    expect(created.completedAt).toBeNull();
    expect(created.createdBy).toBe(context.userId);
    expect(created.createdAt).toBe('2026-11-07T10:00:00.000Z');
    expect(created.updatedAt).toBe('2026-11-07T10:00:00.000Z');

    const listResponse = await context.app.handle(
      new Request(context.todoPath, { headers: authHeader(context.token) })
    );
    expect(listResponse.status).toBe(200);
    const listBody = (await listResponse.json()) as JsonBody;
    expect(listBody.items).toHaveLength(1);
    expect(listBody.pagination).toEqual({ limit: 20, hasMore: false, nextCursor: null });

    const getResponse = await context.app.handle(
      new Request(`${context.todoPath}/${created.id}`, { headers: authHeader(context.token) })
    );
    expect(getResponse.status).toBe(200);
    expect(((await getResponse.json()) as JsonBody).todo.id).toBe(created.id);

    context.clock.advanceByMilliseconds(60_000);

    const patchResponse = await context.app.handle(
      patch(`${context.todoPath}/${created.id}`, context.token, {
        title: 'Learn advanced PostgreSQL',
        description: null,
        status: 'in_progress',
        priority: 'urgent',
        dueAt: '2026-11-12T09:00:00+07:00'
      })
    );
    expect(patchResponse.status).toBe(200);
    const updated = ((await patchResponse.json()) as JsonBody).todo;
    expect(updated.title).toBe('Learn advanced PostgreSQL');
    expect(updated.description).toBeNull();
    expect(updated.status).toBe('in_progress');
    expect(updated.priority).toBe('urgent');
    expect(updated.dueAt).toBe('2026-11-12T02:00:00.000Z');
    expect(updated.updatedAt).toBe('2026-11-07T10:01:00.000Z');

    const completeResponse = await context.app.handle(
      patch(`${context.todoPath}/${created.id}/complete`, context.token)
    );
    expect(completeResponse.status).toBe(200);
    const completed = ((await completeResponse.json()) as JsonBody).todo;
    expect(completed.status).toBe('completed');
    expect(completed.completedAt).toBe('2026-11-07T10:01:00.000Z');

    const repeatedComplete = await context.app.handle(
      patch(`${context.todoPath}/${created.id}/complete`, context.token)
    );
    expect(repeatedComplete.status).toBe(200);
    const repeated = ((await repeatedComplete.json()) as JsonBody).todo;
    expect(repeated.completedAt).toBe(completed.completedAt);
    expect(repeated.updatedAt).toBe(completed.updatedAt);

    const deleteResponse = await context.app.handle(
      new Request(`${context.todoPath}/${created.id}`, {
        method: 'DELETE',
        headers: authHeader(context.token)
      })
    );
    expect(deleteResponse.status).toBe(204);

    const getDeleted = await context.app.handle(
      new Request(`${context.todoPath}/${created.id}`, { headers: authHeader(context.token) })
    );
    expect(getDeleted.status).toBe(404);

    const listAfterDelete = await context.app.handle(
      new Request(context.todoPath, { headers: authHeader(context.token) })
    );
    expect(((await listAfterDelete.json()) as JsonBody).items).toHaveLength(0);
  });

  test('delete idempoten mengembalikan 204 berulang kali', async () => {
    const context = await setup();
    const todo = await createTodo(context);
    const first = await context.app.handle(
      new Request(`${context.todoPath}/${todo.id}`, {
        method: 'DELETE',
        headers: authHeader(context.token)
      })
    );
    const second = await context.app.handle(
      new Request(`${context.todoPath}/${todo.id}`, {
        method: 'DELETE',
        headers: authHeader(context.token)
      })
    );

    expect(first.status).toBe(204);
    expect(second.status).toBe(204);
  });
});

describe('Todo endpoints — validation', () => {
  test('menolak title kosong setelah trim dengan TODO_TITLE_REQUIRED', async () => {
    const context = await setup();
    const response = await context.app.handle(post(context.todoPath, context.token, { title: '   ' }));

    expect(response.status).toBe(422);
    expect(((await response.json()) as JsonBody).error.code).toBe('TODO_TITLE_REQUIRED');
  });

  test('menolak title yang terlalu panjang di schema', async () => {
    const context = await setup();
    const response = await context.app.handle(
      post(context.todoPath, context.token, { title: 'a'.repeat(201) })
    );

    expect(response.status).toBe(422);
    expect(((await response.json()) as JsonBody).error.code).toBe('VALIDATION_ERROR');
  });

  test('menolak priority/status di luar enum', async () => {
    const context = await setup();
    const priorityResponse = await context.app.handle(
      post(context.todoPath, context.token, { title: 'Valid', priority: 'critical' })
    );
    expect(priorityResponse.status).toBe(422);

    const todo = await createTodo(context);
    const statusResponse = await context.app.handle(
      patch(`${context.todoPath}/${todo.id}`, context.token, { status: 'done' })
    );
    expect(statusResponse.status).toBe(422);
  });

  test('menolak dueAt tanpa timezone eksplisit', async () => {
    const context = await setup();
    const response = await context.app.handle(
      post(context.todoPath, context.token, {
        title: 'Valid',
        dueAt: '2026-11-10T09:00:00'
      })
    );

    expect(response.status).toBe(422);
  });

  test('menolak metadata internal dari client', async () => {
    const context = await setup();
    const response = await context.app.handle(
      post(context.todoPath, context.token, {
        title: 'Valid',
        id: crypto.randomUUID(),
        workspaceId: crypto.randomUUID(),
        createdBy: crypto.randomUUID(),
        status: 'completed'
      })
    );

    expect(response.status).toBe(422);

    const todo = await createTodo(context);
    const updateResponse = await context.app.handle(
      patch(`${context.todoPath}/${todo.id}`, context.token, {
        title: 'Tetap valid',
        createdBy: crypto.randomUUID()
      })
    );
    expect(updateResponse.status).toBe(422);
  });

  test('menolak update tanpa field', async () => {
    const context = await setup();
    const todo = await createTodo(context);
    const response = await context.app.handle(
      patch(`${context.todoPath}/${todo.id}`, context.token, {})
    );

    expect(response.status).toBe(422);
  });

  test('menolak limit di atas 100 dan cursor rusak', async () => {
    const context = await setup();
    const limitResponse = await context.app.handle(
      new Request(`${context.todoPath}?limit=101`, { headers: authHeader(context.token) })
    );
    expect(limitResponse.status).toBe(422);

    const cursorResponse = await context.app.handle(
      new Request(`${context.todoPath}?cursor=bukan-cursor`, { headers: authHeader(context.token) })
    );
    expect(cursorResponse.status).toBe(400);
    expect(((await cursorResponse.json()) as JsonBody).error.code).toBe('INVALID_CURSOR');
  });

  test('menolak timezone invalid pada Today', async () => {
    const context = await setup();
    const response = await context.app.handle(
      new Request(`${context.todoPath}/today?timezone=Asia%2FJakarta%2B7`, {
        headers: authHeader(context.token)
      })
    );

    expect(response.status).toBe(422);
    expect(((await response.json()) as JsonBody).error.code).toBe('INVALID_TIMEZONE');
  });
});

describe('Todo endpoints — listing, filtering, dan pagination', () => {
  test('pagination cursor dua halaman tanpa duplikasi', async () => {
    const context = await setup();
    const created: string[] = [];

    for (let index = 0; index < 3; index += 1) {
      context.clock.advanceByMilliseconds(1_000);
      const todo = await createTodo(context, { title: `Todo ${index}` });
      created.push(todo.id);
    }

    const firstResponse = await context.app.handle(
      new Request(`${context.todoPath}?limit=2`, { headers: authHeader(context.token) })
    );
    const firstBody = (await firstResponse.json()) as JsonBody;

    expect(firstBody.items.map((item: JsonBody) => item.id)).toEqual([created[2], created[1]]);
    expect(firstBody.pagination.hasMore).toBe(true);
    expect(firstBody.pagination.nextCursor).toBeString();

    const cursor = encodeURIComponent(firstBody.pagination.nextCursor);
    const secondResponse = await context.app.handle(
      new Request(`${context.todoPath}?limit=2&cursor=${cursor}`, {
        headers: authHeader(context.token)
      })
    );
    const secondBody = (await secondResponse.json()) as JsonBody;

    expect(secondBody.items.map((item: JsonBody) => item.id)).toEqual([created[0]]);
    expect(secondBody.pagination.hasMore).toBe(false);
    expect(secondBody.pagination.nextCursor).toBeNull();
  });

  test('filter status, priority, search, dan date range melalui query', async () => {
    const context = await setup();
    const high = await createTodo(context, {
      title: 'PostgreSQL advanced',
      priority: 'high',
      dueAt: '2026-11-10T09:00:00+07:00'
    });
    await createTodo(context, {
      title: 'Redis',
      priority: 'low',
      dueAt: '2026-11-10T09:00:00+07:00'
    });

    await context.app.handle(
      patch(`${context.todoPath}/${high.id}`, context.token, { status: 'in_progress' })
    );

    const response = await context.app.handle(
      new Request(
        `${context.todoPath}?status=in_progress&priority=high&q=postgres&dueFrom=2026-11-09T00:00:00Z&dueTo=2026-11-11T00:00:00Z`,
        { headers: authHeader(context.token) }
      )
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as JsonBody;
    expect(body.items.map((item: JsonBody) => item.id)).toEqual([high.id]);
  });

  test('filter tanggal terbalik ditolak dengan INVALID_DATE_RANGE', async () => {
    const context = await setup();
    const response = await context.app.handle(
      new Request(
        `${context.todoPath}?dueFrom=2026-11-12T00:00:00Z&dueTo=2026-11-10T00:00:00Z`,
        { headers: authHeader(context.token) }
      )
    );

    expect(response.status).toBe(422);
    expect(((await response.json()) as JsonBody).error.code).toBe('INVALID_DATE_RANGE');
  });
});

describe('Todo endpoints — Today, Upcoming, Overdue', () => {
  test('Today menghormati timezone, includeCompleted, dan tidak menangkap todoId', async () => {
    const context = await setup();
    const today = await createTodo(context, {
      title: 'Hari ini',
      dueAt: '2026-11-07T20:00:00+07:00'
    });
    const completed = await createTodo(context, {
      title: 'Selesai hari ini',
      dueAt: '2026-11-07T21:00:00+07:00'
    });
    const tomorrow = await createTodo(context, {
      title: 'Besok',
      dueAt: '2026-11-08T09:00:00+07:00'
    });

    await context.app.handle(patch(`${context.todoPath}/${completed.id}/complete`, context.token));

    const defaultResponse = await context.app.handle(
      new Request(`${context.todoPath}/today?timezone=Asia%2FJakarta`, {
        headers: authHeader(context.token)
      })
    );
    expect(defaultResponse.status).toBe(200);
    const defaultBody = (await defaultResponse.json()) as JsonBody;
    expect(defaultBody.items.map((item: JsonBody) => item.id)).toEqual([today.id]);

    const includeResponse = await context.app.handle(
      new Request(`${context.todoPath}/today?timezone=Asia%2FJakarta&includeCompleted=true`, {
        headers: authHeader(context.token)
      })
    );
    const includeBody = (await includeResponse.json()) as JsonBody;
    expect(new Set(includeBody.items.map((item: JsonBody) => item.id))).toEqual(
      new Set([today.id, completed.id])
    );
    expect(includeBody.items.map((item: JsonBody) => item.id)).not.toContain(tomorrow.id);
  });

  test('Upcoming default 7 hari dan custom days divalidasi', async () => {
    const context = await setup();
    const tomorrow = await createTodo(context, {
      title: 'Besok',
      dueAt: '2026-11-08T09:00:00Z'
    });
    const later = await createTodo(context, {
      title: 'Hari ke-10',
      dueAt: '2026-11-17T09:00:00Z'
    });

    const defaultResponse = await context.app.handle(
      new Request(`${context.todoPath}/upcoming?timezone=UTC`, {
        headers: authHeader(context.token)
      })
    );
    const defaultBody = (await defaultResponse.json()) as JsonBody;
    expect(defaultBody.items.map((item: JsonBody) => item.id)).toEqual([tomorrow.id]);

    const tenDays = await context.app.handle(
      new Request(`${context.todoPath}/upcoming?timezone=UTC&days=10`, {
        headers: authHeader(context.token)
      })
    );
    const tenDaysBody = (await tenDays.json()) as JsonBody;
    expect(new Set(tenDaysBody.items.map((item: JsonBody) => item.id))).toEqual(
      new Set([tomorrow.id, later.id])
    );

    const invalid = await context.app.handle(
      new Request(`${context.todoPath}/upcoming?timezone=UTC&days=31`, {
        headers: authHeader(context.token)
      })
    );
    expect(invalid.status).toBe(422);
  });

  test('Overdue memakai batas hari timezone dan tidak mengubah status', async () => {
    const context = await setup();
    const overdue = await createTodo(context, {
      title: 'Kemarin',
      dueAt: '2026-11-06T23:00:00Z'
    });
    await createTodo(context, {
      title: 'Hari ini',
      dueAt: '2026-11-07T09:00:00Z'
    });

    const response = await context.app.handle(
      new Request(`${context.todoPath}/overdue?timezone=UTC`, {
        headers: authHeader(context.token)
      })
    );
    const body = (await response.json()) as JsonBody;

    expect(body.items.map((item: JsonBody) => item.id)).toEqual([overdue.id]);
    expect(body.items[0].status).toBe('todo');
  });
});
