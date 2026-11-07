import { describe, expect, test } from 'bun:test';
import { createTodoTestApp } from '../../helpers/todo-test-app';

type OpenApiOperation = {
  tags?: string[];
  summary?: string;
  description?: string;
  security?: Record<string, unknown>[];
  parameters?: { name: string; in: string; description?: string; schema?: Record<string, unknown> }[];
  requestBody?: { content?: Record<string, { schema?: Record<string, unknown> }> };
  responses: Record<string, { description?: string; content?: Record<string, { schema?: unknown }> }>;
};

type OpenApiSpec = {
  paths: Record<string, Record<string, OpenApiOperation>>;
};

async function loadSpec(): Promise<OpenApiSpec> {
  const { app } = createTodoTestApp();
  const response = await app.handle(new Request('http://test.local/openapi/json'));

  expect(response.status).toBe(200);

  return (await response.json()) as OpenApiSpec;
}

const BASE = '/api/v1/workspaces/{workspaceId}/todos';

describe('OpenAPI Phase 3 — Todo', () => {
  test('seluruh endpoint Todo terdaftar', async () => {
    const spec = await loadSpec();

    expect(Object.keys(spec.paths)).toContain(BASE);
    expect(Object.keys(spec.paths)).toContain(`${BASE}/today`);
    expect(Object.keys(spec.paths)).toContain(`${BASE}/upcoming`);
    expect(Object.keys(spec.paths)).toContain(`${BASE}/overdue`);
    expect(Object.keys(spec.paths)).toContain(`${BASE}/{todoId}`);
    expect(Object.keys(spec.paths)).toContain(`${BASE}/{todoId}/complete`);

    expect(spec.paths[BASE]?.post).toBeDefined();
    expect(spec.paths[BASE]?.get).toBeDefined();
    expect(spec.paths[`${BASE}/{todoId}`]?.get).toBeDefined();
    expect(spec.paths[`${BASE}/{todoId}`]?.patch).toBeDefined();
    expect(spec.paths[`${BASE}/{todoId}`]?.delete).toBeDefined();
    expect(spec.paths[`${BASE}/{todoId}/complete`]?.patch).toBeDefined();
  });

  test('setiap operasi memiliki tag, summary, deskripsi, security, dan response sukses', async () => {
    const spec = await loadSpec();
    const operations = [
      spec.paths[BASE]?.post,
      spec.paths[BASE]?.get,
      spec.paths[`${BASE}/today`]?.get,
      spec.paths[`${BASE}/upcoming`]?.get,
      spec.paths[`${BASE}/overdue`]?.get,
      spec.paths[`${BASE}/{todoId}`]?.get,
      spec.paths[`${BASE}/{todoId}`]?.patch,
      spec.paths[`${BASE}/{todoId}/complete`]?.patch,
      spec.paths[`${BASE}/{todoId}`]?.delete
    ];

    for (const operation of operations) {
      expect(operation).toBeDefined();
      expect(operation?.tags).toContain('Todo');
      expect(operation?.summary).toBeString();
      expect(operation?.description?.length ?? 0).toBeGreaterThan(20);
      expect(operation?.security).toEqual([{ bearerAuth: [] }]);
      expect(Object.keys(operation?.responses ?? {}).length).toBeGreaterThan(0);
    }
  });

  test('query listing mendokumentasikan filter dan cursor', async () => {
    const spec = await loadSpec();
    const parameters = spec.paths[BASE]?.get?.parameters ?? [];
    const names = parameters.filter((parameter) => parameter.in === 'query').map((parameter) => parameter.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'limit',
        'cursor',
        'status',
        'priority',
        'dueFrom',
        'dueTo',
        'createdFrom',
        'createdTo',
        'q'
      ])
    );

    const cursor = parameters.find((parameter) => parameter.name === 'cursor');
    const cursorDescription =
      cursor?.description ??
      (typeof cursor?.schema?.description === 'string' ? cursor.schema.description : undefined);
    expect(cursorDescription).toInclude('opaque');
    expect(JSON.stringify(spec.paths[BASE]?.get?.responses['200'])).toInclude('nextCursor');
    expect(JSON.stringify(spec.paths[BASE]?.get?.responses['200'])).toInclude('hasMore');
  });

  test('query Today/Upcoming/Overdue mendokumentasikan timezone dan parameter khusus', async () => {
    const spec = await loadSpec();

    const today = spec.paths[`${BASE}/today`]?.get?.parameters ?? [];
    const todayNames = today.map((parameter) => parameter.name);
    expect(todayNames).toEqual(expect.arrayContaining(['timezone', 'includeCompleted', 'limit', 'cursor']));

    const upcoming = spec.paths[`${BASE}/upcoming`]?.get?.parameters ?? [];
    expect(upcoming.map((parameter) => parameter.name)).toEqual(
      expect.arrayContaining(['timezone', 'days', 'limit', 'cursor'])
    );

    const overdue = spec.paths[`${BASE}/overdue`]?.get?.parameters ?? [];
    expect(overdue.map((parameter) => parameter.name)).toEqual(
      expect.arrayContaining(['timezone', 'limit', 'cursor'])
    );
  });

  test('error response yang didokumentasikan memakai schema error standar', async () => {
    const spec = await loadSpec();
    const patchTodo = spec.paths[`${BASE}/{todoId}`]?.patch;

    expect(Object.keys(patchTodo?.responses ?? {})).toEqual(
      expect.arrayContaining(['200', '401', '404', '422'])
    );

    const errorSchema = JSON.stringify(patchTodo?.responses['422']?.content);
    expect(errorSchema).toInclude('requestId');
    expect(errorSchema).toInclude('VALIDATION_ERROR');
  });

  test('listing mendokumentasikan filter tagIds dan labelId', async () => {
    const spec = await loadSpec();
    const views = [BASE, `${BASE}/today`, `${BASE}/upcoming`, `${BASE}/overdue`];

    for (const path of views) {
      const names = (spec.paths[path]?.get?.parameters ?? [])
        .filter((parameter) => parameter.in === 'query')
        .map((parameter) => parameter.name);

      expect(names).toEqual(expect.arrayContaining(['tagIds', 'labelId']));
    }

    const todoSchema = JSON.stringify(spec.paths[`${BASE}/{todoId}`]?.get?.responses['200']);
    expect(todoSchema).toInclude('label');
    expect(todoSchema).toInclude('tags');
  });
});

describe('OpenAPI Phase 4 — Tag, Label, Reminder', () => {
  test('seluruh endpoint metadata terdaftar', async () => {
    const spec = await loadSpec();
    const workspace = '/api/v1/workspaces/{workspaceId}';

    expect(spec.paths[`${workspace}/tags`]?.post?.tags).toContain('Tag');
    expect(spec.paths[`${workspace}/tags`]?.get?.tags).toContain('Tag');
    expect(spec.paths[`${workspace}/tags/{tagId}`]?.get?.tags).toContain('Tag');
    expect(spec.paths[`${workspace}/tags/{tagId}`]?.patch?.tags).toContain('Tag');
    expect(spec.paths[`${workspace}/tags/{tagId}`]?.delete?.tags).toContain('Tag');
    expect(spec.paths[`${workspace}/todos/{todoId}/tags`]?.put?.tags).toContain('Tag');
    expect(spec.paths[`${workspace}/todos/{todoId}/tags/{tagId}`]?.post?.tags).toContain('Tag');
    expect(spec.paths[`${workspace}/todos/{todoId}/tags/{tagId}`]?.delete?.tags).toContain('Tag');

    expect(spec.paths[`${workspace}/labels`]?.post?.tags).toContain('Label');
    expect(spec.paths[`${workspace}/labels`]?.get?.tags).toContain('Label');
    expect(spec.paths[`${workspace}/labels/{labelId}`]?.get?.tags).toContain('Label');
    expect(spec.paths[`${workspace}/labels/{labelId}`]?.patch?.tags).toContain('Label');
    expect(spec.paths[`${workspace}/labels/{labelId}`]?.delete?.tags).toContain('Label');
    expect(spec.paths[`${workspace}/todos/{todoId}/label`]?.put?.tags).toContain('Label');
    expect(spec.paths[`${workspace}/todos/{todoId}/label`]?.delete?.tags).toContain('Label');

    expect(spec.paths[`${workspace}/todos/{todoId}/reminders`]?.post?.tags).toContain('Reminder');
    expect(spec.paths[`${workspace}/todos/{todoId}/reminders`]?.get?.tags).toContain('Reminder');
    expect(spec.paths[`${workspace}/todos/{todoId}/reminders/{reminderId}`]?.get?.tags).toContain(
      'Reminder'
    );
    expect(spec.paths[`${workspace}/todos/{todoId}/reminders/{reminderId}`]?.patch?.tags).toContain(
      'Reminder'
    );
    expect(spec.paths[`${workspace}/todos/{todoId}/reminders/{reminderId}`]?.delete?.tags).toContain(
      'Reminder'
    );
  });

  test('setiap operasi metadata punya security dan response sukses', async () => {
    const spec = await loadSpec();
    const operations = Object.values(spec.paths)
      .flatMap((pathItem) => Object.values(pathItem))
      .filter((operation) =>
        operation.tags?.some((tag) => tag === 'Tag' || tag === 'Label' || tag === 'Reminder')
      );

    expect(operations.length).toBeGreaterThanOrEqual(20);

    for (const operation of operations) {
      expect(operation.summary).toBeString();
      expect(operation.description?.length ?? 0).toBeGreaterThan(20);
      expect(operation.security).toEqual([{ bearerAuth: [] }]);
      expect(Object.keys(operation.responses).length).toBeGreaterThan(0);
    }
  });
});
