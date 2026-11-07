import { describe, expect, test } from 'bun:test';
import { WorkspaceRole } from '../../src/modules/workspace/domain/enums/workspace-role';
import {
  addWorkspaceMember,
  authHeader,
  createAuthenticatedUser,
  createTodoTestApp,
  createWorkspaceForUser,
  jsonHeaders,
  type TodoTestApp
} from '../helpers/todo-test-app';

type JsonBody = any;

interface TestContext {
  readonly fixture: TodoTestApp;
  readonly app: TodoTestApp['app'];
  readonly token: string;
  readonly workspaceId: string;
  readonly base: string;
}

async function setup(): Promise<TestContext> {
  const fixture = createTodoTestApp();
  const { userId, token } = await createAuthenticatedUser(
    fixture.authRepo,
    fixture.accessTokenService,
    `meta_${crypto.randomUUID()}@example.com`
  );
  const workspace = await createWorkspaceForUser(fixture.workspaceRepo, userId);

  return {
    fixture,
    app: fixture.app,
    token,
    workspaceId: workspace.id,
    base: `http://test.local/api/v1/workspaces/${workspace.id}`
  };
}

function post(path: string, token: string, body: unknown): Request {
  return new Request(path, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(body)
  });
}

function patch(path: string, token: string, body: unknown): Request {
  return new Request(path, {
    method: 'PATCH',
    headers: jsonHeaders(token),
    body: JSON.stringify(body)
  });
}

function put(path: string, token: string, body: unknown): Request {
  return new Request(path, {
    method: 'PUT',
    headers: jsonHeaders(token),
    body: JSON.stringify(body)
  });
}

async function createTodo(context: TestContext, body: Record<string, unknown> = { title: 'Metadata' }): Promise<JsonBody> {
  const response = await context.app.handle(post(`${context.base}/todos`, context.token, body));

  expect(response.status).toBe(201);

  return ((await response.json()) as JsonBody).todo;
}

async function memberContext(context: TestContext): Promise<{ userId: string; token: string }> {
  const member = await createAuthenticatedUser(
    context.fixture.authRepo,
    context.fixture.accessTokenService,
    `member_${crypto.randomUUID()}@example.com`
  );

  addWorkspaceMember(
    context.fixture.workspaceRepo,
    context.workspaceId,
    member.userId,
    WorkspaceRole.MEMBER
  );

  return member;
}

describe('Tag endpoints', () => {
  test('CRUD, pencarian, dan penolakan duplikat', async () => {
    const context = await setup();
    const created = await context.app.handle(
      post(`${context.base}/tags`, context.token, { name: '  Backend  ' })
    );

    expect(created.status).toBe(201);
    const tag = ((await created.json()) as JsonBody).tag;
    expect(tag.name).toBe('Backend');
    expect(tag.workspaceId).toBe(context.workspaceId);
    expect(tag.normalizedName).toBeUndefined();

    const duplicate = await context.app.handle(
      post(`${context.base}/tags`, context.token, { name: 'BACKEND' })
    );
    expect(duplicate.status).toBe(409);
    expect(((await duplicate.json()) as JsonBody).error.code).toBe('TAG_ALREADY_EXISTS');

    const listed = await context.app.handle(
      new Request(`${context.base}/tags?q=back`, { headers: authHeader(context.token) })
    );
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as JsonBody;
    expect(listBody.items.map((item: JsonBody) => item.id)).toEqual([tag.id]);
    expect(listBody.pagination.limit).toBe(20);

    const detail = await context.app.handle(
      new Request(`${context.base}/tags/${tag.id}`, { headers: authHeader(context.token) })
    );
    expect(detail.status).toBe(200);

    const updated = await context.app.handle(
      patch(`${context.base}/tags/${tag.id}`, context.token, { name: 'Backend Development' })
    );
    expect(updated.status).toBe(200);
    expect(((await updated.json()) as JsonBody).tag.name).toBe('Backend Development');

    const removed = await context.app.handle(
      new Request(`${context.base}/tags/${tag.id}`, {
        method: 'DELETE',
        headers: authHeader(context.token)
      })
    );
    expect(removed.status).toBe(204);

    const missing = await context.app.handle(
      new Request(`${context.base}/tags/${tag.id}`, { headers: authHeader(context.token) })
    );
    expect(missing.status).toBe(404);
    expect(((await missing.json()) as JsonBody).error.code).toBe('TAG_NOT_FOUND');
  });

  test('member tidak boleh mengelola tag tetapi boleh assignment', async () => {
    const context = await setup();
    const member = await memberContext(context);
    const todo = await createTodo(context);
    const created = await context.app.handle(
      post(`${context.base}/tags`, context.token, { name: 'Learning' })
    );
    const tag = ((await created.json()) as JsonBody).tag;

    const denied = await context.app.handle(
      post(`${context.base}/tags`, member.token, { name: 'Personal' })
    );
    expect(denied.status).toBe(403);
    expect(((await denied.json()) as JsonBody).error.code).toBe('WORKSPACE_PERMISSION_DENIED');

    const added = await context.app.handle(
      post(`${context.base}/todos/${todo.id}/tags/${tag.id}`, member.token, {})
    );
    expect(added.status).toBe(200);

    const again = await context.app.handle(
      post(`${context.base}/todos/${todo.id}/tags/${tag.id}`, member.token, {})
    );
    expect(again.status).toBe(200);
    expect(((await again.json()) as JsonBody).tags).toEqual([{ id: tag.id, name: 'Learning' }]);

    const removed = await context.app.handle(
      new Request(`${context.base}/todos/${todo.id}/tags/${tag.id}`, {
        method: 'DELETE',
        headers: authHeader(member.token)
      })
    );
    expect(removed.status).toBe(200);
    expect(((await removed.json()) as JsonBody).tags).toEqual([]);

    const removedAgain = await context.app.handle(
      new Request(`${context.base}/todos/${todo.id}/tags/${tag.id}`, {
        method: 'DELETE',
        headers: authHeader(member.token)
      })
    );
    expect(removedAgain.status).toBe(200);
  });

  test('replace menormalkan duplikat, menolak lebih dari 20, dan menolak tag asing', async () => {
    const context = await setup();
    const todo = await createTodo(context);
    const first = ((await (
      await context.app.handle(post(`${context.base}/tags`, context.token, { name: 'A' }))
    ).json()) as JsonBody).tag;
    const second = ((await (
      await context.app.handle(post(`${context.base}/tags`, context.token, { name: 'B' }))
    ).json()) as JsonBody).tag;

    const replaced = await context.app.handle(
      put(`${context.base}/todos/${todo.id}/tags`, context.token, {
        tagIds: [second.id, first.id, second.id]
      })
    );
    expect(replaced.status).toBe(200);
    expect(((await replaced.json()) as JsonBody).tags.map((tag: JsonBody) => tag.id)).toEqual([
      second.id,
      first.id
    ]);

    const cleared = await context.app.handle(
      put(`${context.base}/todos/${todo.id}/tags`, context.token, { tagIds: [] })
    );
    expect(cleared.status).toBe(200);
    expect(((await cleared.json()) as JsonBody).tags).toEqual([]);

    const many = Array.from({ length: 21 }, () => crypto.randomUUID());
    const limited = await context.app.handle(
      put(`${context.base}/todos/${todo.id}/tags`, context.token, { tagIds: many })
    );
    expect(limited.status).toBe(422);
    expect(((await limited.json()) as JsonBody).error.code).toBe('TAG_LIMIT_EXCEEDED');

    const foreign = await context.app.handle(
      put(`${context.base}/todos/${todo.id}/tags`, context.token, {
        tagIds: [crypto.randomUUID()]
      })
    );
    expect(foreign.status).toBe(404);
    expect(((await foreign.json()) as JsonBody).error.code).toBe('TAG_WORKSPACE_MISMATCH');
  });

  test('tanpa token ditolak 401', async () => {
    const context = await setup();
    const response = await context.app.handle(new Request(`${context.base}/tags`));

    expect(response.status).toBe(401);
    expect(((await response.json()) as JsonBody).error.code).toBe('UNAUTHORIZED');
  });
});

describe('Label endpoints', () => {
  test('CRUD, assignment lewat PATCH todo, dan clear', async () => {
    const context = await setup();
    const created = await context.app.handle(
      post(`${context.base}/labels`, context.token, {
        name: ' personal ',
        color: '#3498db',
        description: 'Personal tasks'
      })
    );

    expect(created.status).toBe(201);
    const label = ((await created.json()) as JsonBody).label;
    expect(label.name).toBe('personal');
    expect(label.color).toBe('#3498DB');
    expect(label.description).toBe('Personal tasks');

    const duplicate = await context.app.handle(
      post(`${context.base}/labels`, context.token, {
        name: 'PERSONAL',
        color: '#111111'
      })
    );
    expect(duplicate.status).toBe(409);
    expect(((await duplicate.json()) as JsonBody).error.code).toBe('LABEL_ALREADY_EXISTS');

    const invalidColor = await context.app.handle(
      post(`${context.base}/labels`, context.token, { name: 'Work', color: '#FFF' })
    );
    expect(invalidColor.status).toBe(422);

    const updated = await context.app.handle(
      patch(`${context.base}/labels/${label.id}`, context.token, {
        name: 'Work',
        color: '#2ECC71',
        description: 'Professional tasks'
      })
    );
    expect(updated.status).toBe(200);
    expect(((await updated.json()) as JsonBody).label).toMatchObject({
      name: 'Work',
      color: '#2ECC71',
      description: 'Professional tasks'
    });

    const todo = await createTodo(context);
    expect(todo.label).toBeNull();
    expect(todo.tags).toEqual([]);

    const assigned = await context.app.handle(
      patch(`${context.base}/todos/${todo.id}`, context.token, { labelId: label.id })
    );
    expect(assigned.status).toBe(200);
    expect(((await assigned.json()) as JsonBody).todo.label).toEqual({
      id: label.id,
      name: 'Work',
      color: '#2ECC71'
    });

    const cleared = await context.app.handle(
      patch(`${context.base}/todos/${todo.id}`, context.token, { labelId: null })
    );
    expect(cleared.status).toBe(200);
    expect(((await cleared.json()) as JsonBody).todo.label).toBeNull();

    const foreign = await context.app.handle(
      patch(`${context.base}/todos/${todo.id}`, context.token, { labelId: crypto.randomUUID() })
    );
    expect(foreign.status).toBe(422);
    expect(((await foreign.json()) as JsonBody).error.code).toBe('TODO_LABEL_ASSIGNMENT_INVALID');

    const removed = await context.app.handle(
      new Request(`${context.base}/labels/${label.id}`, {
        method: 'DELETE',
        headers: authHeader(context.token)
      })
    );
    expect(removed.status).toBe(204);

    const stillThere = await context.app.handle(
      new Request(`${context.base}/todos/${todo.id}`, { headers: authHeader(context.token) })
    );
    expect(stillThere.status).toBe(200);
    expect(((await stillThere.json()) as JsonBody).todo.label).toBeNull();
  });

  test('member tidak boleh membuat label tetapi boleh memasangnya', async () => {
    const context = await setup();
    const member = await memberContext(context);
    const created = await context.app.handle(
      post(`${context.base}/labels`, context.token, { name: 'Study', color: '#9B59B6' })
    );
    const label = ((await created.json()) as JsonBody).label;
    const todo = await createTodo(context);

    const denied = await context.app.handle(
      post(`${context.base}/labels`, member.token, { name: 'Finance', color: '#111111' })
    );
    expect(denied.status).toBe(403);

    const assigned = await context.app.handle(
      put(`${context.base}/todos/${todo.id}/label`, member.token, { labelId: label.id })
    );
    expect(assigned.status).toBe(200);
    expect(((await assigned.json()) as JsonBody).todo.label.id).toBe(label.id);

    const cleared = await context.app.handle(
      new Request(`${context.base}/todos/${todo.id}/label`, {
        method: 'DELETE',
        headers: authHeader(member.token)
      })
    );
    expect(cleared.status).toBe(200);
    expect(((await cleared.json()) as JsonBody).todo.label).toBeNull();
  });

  test('filter tagIds ANY dan labelId tersedia pada listing serta view', async () => {
    const context = await setup();
    const label = ((await (
      await context.app.handle(
        post(`${context.base}/labels`, context.token, { name: 'Work', color: '#2ECC71' })
      )
    ).json()) as JsonBody).label;
    const tagA = ((await (
      await context.app.handle(post(`${context.base}/tags`, context.token, { name: 'backend' }))
    ).json()) as JsonBody).tag;
    const tagB = ((await (
      await context.app.handle(post(`${context.base}/tags`, context.token, { name: 'docs' }))
    ).json()) as JsonBody).tag;

    const todayMatch = await createTodo(context, {
      title: 'Hari ini',
      dueAt: '2026-11-07T12:00:00.000Z'
    });
    const todayOther = await createTodo(context, {
      title: 'Hari ini lain',
      dueAt: '2026-11-07T15:00:00.000Z'
    });
    const upcomingMatch = await createTodo(context, {
      title: 'Besok',
      dueAt: '2026-11-08T12:00:00.000Z'
    });
    const overdueMatch = await createTodo(context, {
      title: 'Lewat',
      dueAt: '2026-11-06T12:00:00.000Z'
    });
    const overdueOther = await createTodo(context, {
      title: 'Lewat lain',
      dueAt: '2026-11-05T12:00:00.000Z'
    });

    for (const todoId of [todayMatch.id, upcomingMatch.id, overdueMatch.id]) {
      const assigned = await context.app.handle(
        patch(`${context.base}/todos/${todoId}`, context.token, { labelId: label.id })
      );
      expect(assigned.status).toBe(200);
      const tagged = await context.app.handle(
        put(`${context.base}/todos/${todoId}/tags`, context.token, { tagIds: [tagA.id] })
      );
      expect(tagged.status).toBe(200);
    }

    await context.app.handle(
      put(`${context.base}/todos/${todayOther.id}/tags`, context.token, { tagIds: [tagB.id] })
    );
    await context.app.handle(
      put(`${context.base}/todos/${overdueOther.id}/tags`, context.token, { tagIds: [tagB.id] })
    );

    const listed = await context.app.handle(
      new Request(
        `${context.base}/todos?tagIds=${tagA.id}&tagIds=${tagB.id}&labelId=${label.id}`,
        { headers: authHeader(context.token) }
      )
    );
    expect(listed.status).toBe(200);
    const items = ((await listed.json()) as JsonBody).items;
    expect(items.map((item: JsonBody) => item.id)).toContain(todayMatch.id);
    expect(items.map((item: JsonBody) => item.id)).not.toContain(todayOther.id);
    expect(items[0].label.id).toBe(label.id);

    const views: Array<[string, string, string]> = [
      [
        `${context.base}/todos/today?timezone=UTC&tagIds=${tagA.id}&labelId=${label.id}`,
        todayMatch.id,
        todayOther.id
      ],
      [
        `${context.base}/todos/upcoming?timezone=UTC&days=7&tagIds=${tagA.id}&labelId=${label.id}`,
        upcomingMatch.id,
        todayOther.id
      ],
      [
        `${context.base}/todos/overdue?timezone=UTC&tagIds=${tagA.id}&labelId=${label.id}`,
        overdueMatch.id,
        overdueOther.id
      ]
    ];

    for (const [path, expectedId, excludedId] of views) {
      const response = await context.app.handle(
        new Request(path, { headers: authHeader(context.token) })
      );
      expect(response.status).toBe(200);
      const ids = ((await response.json()) as JsonBody).items.map((item: JsonBody) => item.id);
      expect(ids).toContain(expectedId);
      expect(ids).not.toContain(excludedId);
    }
  });
});

describe('Reminder endpoints', () => {
  test('absolute, before_due, update, dan cancel idempoten', async () => {
    const context = await setup();
    const todo = await createTodo(context, {
      title: 'Dengan due date',
      dueAt: '2026-11-10T09:00:00.000Z'
    });
    const reminders = `${context.base}/todos/${todo.id}/reminders`;

    const absolute = await context.app.handle(
      post(reminders, context.token, {
        triggerType: 'absolute',
        remindAt: '2026-11-09T08:00:00+07:00'
      })
    );
    expect(absolute.status).toBe(201);
    const absoluteBody = ((await absolute.json()) as JsonBody).reminder;
    expect(absoluteBody.triggerType).toBe('absolute');
    expect(absoluteBody.remindAt).toBe('2026-11-09T01:00:00.000Z');
    expect(absoluteBody.offsetMinutes).toBeNull();
    expect(absoluteBody.effectiveAt).toBe('2026-11-09T01:00:00.000Z');
    expect(absoluteBody.status).toBe('scheduled');

    const relative = await context.app.handle(
      post(reminders, context.token, { triggerType: 'before_due', offsetMinutes: 60 })
    );
    expect(relative.status).toBe(201);
    const relativeBody = ((await relative.json()) as JsonBody).reminder;
    expect(relativeBody.remindAt).toBeNull();
    expect(relativeBody.offsetMinutes).toBe(60);
    expect(relativeBody.effectiveAt).toBe('2026-11-10T08:00:00.000Z');

    const duplicate = await context.app.handle(
      post(reminders, context.token, { triggerType: 'before_due', offsetMinutes: 60 })
    );
    expect(duplicate.status).toBe(409);
    expect(((await duplicate.json()) as JsonBody).error.code).toBe('REMINDER_DUPLICATE');

    const past = await context.app.handle(
      post(reminders, context.token, {
        triggerType: 'absolute',
        remindAt: '2026-11-01T08:00:00Z'
      })
    );
    expect(past.status).toBe(422);
    expect(((await past.json()) as JsonBody).error.code).toBe('REMINDER_TIME_IN_PAST');

    const listed = await context.app.handle(
      new Request(reminders, { headers: authHeader(context.token) })
    );
    expect(listed.status).toBe(200);
    const listBody = (await listed.json()) as JsonBody;
    expect(listBody.items.map((item: JsonBody) => item.id)).toEqual([
      absoluteBody.id,
      relativeBody.id
    ]);
    expect(listBody.items.every((item: JsonBody) => typeof item.effectiveAt === 'string')).toBe(true);

    const updated = await context.app.handle(
      patch(`${reminders}/${absoluteBody.id}`, context.token, {
        remindAt: '2026-11-09T10:00:00+07:00'
      })
    );
    expect(updated.status).toBe(200);
    expect(((await updated.json()) as JsonBody).reminder.effectiveAt).toBe('2026-11-09T03:00:00.000Z');

    const cancelled = await context.app.handle(
      new Request(`${reminders}/${relativeBody.id}`, {
        method: 'DELETE',
        headers: authHeader(context.token)
      })
    );
    expect(cancelled.status).toBe(204);

    const cancelledAgain = await context.app.handle(
      new Request(`${reminders}/${relativeBody.id}`, {
        method: 'DELETE',
        headers: authHeader(context.token)
      })
    );
    expect(cancelledAgain.status).toBe(204);

    const history = await context.app.handle(
      new Request(`${reminders}?status=cancelled`, { headers: authHeader(context.token) })
    );
    expect(history.status).toBe(200);
    expect(((await history.json()) as JsonBody).items.map((item: JsonBody) => item.id)).toEqual([
      relativeBody.id
    ]);

    const revive = await context.app.handle(
      patch(`${reminders}/${relativeBody.id}`, context.token, { offsetMinutes: 30 })
    );
    expect(revive.status).toBe(409);
    expect(((await revive.json()) as JsonBody).error.code).toBe('REMINDER_ALREADY_CANCELLED');
  });

  test('todo tanpa dueAt menolak before_due dan todo completed menolak reminder baru', async () => {
    const context = await setup();
    const todo = await createTodo(context);
    const missingDue = await context.app.handle(
      post(`${context.base}/todos/${todo.id}/reminders`, context.token, {
        triggerType: 'before_due',
        offsetMinutes: 15
      })
    );
    expect(missingDue.status).toBe(422);
    expect(((await missingDue.json()) as JsonBody).error.code).toBe('REMINDER_DUE_DATE_REQUIRED');

    const completed = await context.app.handle(
      new Request(`${context.base}/todos/${todo.id}/complete`, {
        method: 'PATCH',
        headers: authHeader(context.token)
      })
    );
    expect(completed.status).toBe(200);

    const denied = await context.app.handle(
      post(`${context.base}/todos/${todo.id}/reminders`, context.token, {
        triggerType: 'absolute',
        remindAt: '2026-11-09T08:00:00Z'
      })
    );
    expect(denied.status).toBe(422);
    expect(((await denied.json()) as JsonBody).error.code).toBe('REMINDER_TODO_INELIGIBLE');
  });

  test('perubahan dueAt yang menabrak reminder before_due ditolak', async () => {
    const context = await setup();
    const todo = await createTodo(context, {
      title: 'Jadwal',
      dueAt: '2026-11-10T09:00:00.000Z'
    });

    const created = await context.app.handle(
      post(`${context.base}/todos/${todo.id}/reminders`, context.token, {
        triggerType: 'before_due',
        offsetMinutes: 30
      })
    );
    expect(created.status).toBe(201);

    const cleared = await context.app.handle(
      patch(`${context.base}/todos/${todo.id}`, context.token, { dueAt: null })
    );
    expect(cleared.status).toBe(409);
    expect(((await cleared.json()) as JsonBody).error.code).toBe('TODO_HAS_RELATIVE_REMINDERS');

    const past = await context.app.handle(
      patch(`${context.base}/todos/${todo.id}`, context.token, {
        dueAt: '2026-11-07T10:10:00.000Z'
      })
    );
    expect(past.status).toBe(409);
    expect(((await past.json()) as JsonBody).error.code).toBe(
      'TODO_DUE_DATE_CONFLICTS_WITH_REMINDERS'
    );
  });

  test('bukan member tidak dapat melihat reminder', async () => {
    const context = await setup();
    const outsider = await createAuthenticatedUser(
      context.fixture.authRepo,
      context.fixture.accessTokenService,
      `out_${crypto.randomUUID()}@example.com`
    );
    const response = await context.app.handle(
      new Request(`${context.base}/todos/${crypto.randomUUID()}/reminders`, {
        headers: authHeader(outsider.token)
      })
    );

    expect(response.status).toBe(404);
    expect(((await response.json()) as JsonBody).error.code).toBe('WORKSPACE_ACCESS_DENIED');
  });
});
