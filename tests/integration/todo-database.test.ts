import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { loadAppConfig } from '../../src/config/app-config';
import { createDatabaseClient, type DatabaseClient } from '../../src/shared/infrastructure/database/client';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { DrizzleAuthRepository } from '../../src/modules/auth/infrastructure/persistence/drizzle-auth.repository';
import { DrizzleWorkspaceRepository } from '../../src/modules/workspace/infrastructure/persistence/drizzle-workspace.repository';
import { DrizzleTodoRepository } from '../../src/modules/todo/infrastructure/persistence/drizzle-todo.repository';
import { Base64UrlCursorCodec } from '../../src/modules/todo/infrastructure/pagination/cursor-encoder';
import { toEmail } from '../../src/modules/auth/domain/value-objects/email';
import { Todo } from '../../src/modules/todo/domain/entities/todo';
import { TodoPriority } from '../../src/modules/todo/domain/enums/todo-priority';
import { TodoStatus } from '../../src/modules/todo/domain/enums/todo-status';
import type { TodoQueryCriteria } from '../../src/modules/todo/domain/repositories/todo.repository';

const config = loadAppConfig();
const silentLogger = createLogger('silent');

let client: DatabaseClient;
let authRepo: DrizzleAuthRepository;
let workspaceRepo: DrizzleWorkspaceRepository;
let todoRepo: DrizzleTodoRepository;

beforeAll(() => {
  client = createDatabaseClient(config.database, silentLogger);
  authRepo = new DrizzleAuthRepository(client);
  workspaceRepo = new DrizzleWorkspaceRepository(client);
  todoRepo = new DrizzleTodoRepository(client.db);
});

afterAll(async () => {
  await client.close();
});

async function createOwner(): Promise<{ userId: string; workspaceId: string }> {
  const now = new Date();
  const user = await authRepo.createNewUser({
    email: toEmail(`todo_db_${crypto.randomUUID()}@example.com`),
    displayName: 'Todo DB User',
    passwordHash: 'hash',
    now
  });

  const { workspace } = await workspaceRepo.createWorkspaceWithMembership({
    name: `Todo DB Workspace ${crypto.randomUUID().slice(0, 8)}`,
    description: null,
    createdBy: user.id,
    now
  });

  return { userId: user.id, workspaceId: workspace.id };
}

async function seed(options: {
  workspaceId: string;
  userId: string;
  title?: string;
  description?: string | null;
  priority?: TodoPriority;
  dueAt?: Date | null;
  status?: TodoStatus;
  now?: Date;
}): Promise<Todo> {
  const now = options.now ?? new Date('2026-05-01T00:00:00.000Z');
  const created = Todo.create({
    id: crypto.randomUUID(),
    workspaceId: options.workspaceId,
    createdBy: options.userId,
    title: options.title ?? `Todo ${crypto.randomUUID().slice(0, 8)}`,
    description: options.description ?? null,
    priority: options.priority ?? TodoPriority.LOW,
    dueAt: options.dueAt ?? null,
    now
  });

  const entity =
    options.status !== undefined && options.status !== TodoStatus.TODO
      ? created.update({ status: options.status }, now)
      : created;

  return await todoRepo.create(entity);
}

async function listIds(options: {
  workspaceId: string;
  criteria?: TodoQueryCriteria;
  limit?: number;
  cursor?: { createdAt: Date; id: string } | null;
}): Promise<{ ids: string[]; hasMore: boolean; last?: Todo }> {
  const result = await todoRepo.list({
    workspaceId: options.workspaceId,
    criteria: options.criteria ?? {},
    limit: options.limit ?? 20,
    cursor: options.cursor ?? null
  });

  return {
    ids: result.items.map((todo) => todo.id),
    hasMore: result.hasMore,
    ...(result.items[result.items.length - 1]
      ? { last: result.items[result.items.length - 1] as Todo }
      : {})
  };
}

async function executeExpectingFailure(query: ReturnType<typeof sql>): Promise<void> {
  try {
    await client.db.execute(query);
  } catch {
    return;
  }

  throw new Error('Query seharusnya melanggar constraint database');
}

describe('DrizzleTodoRepository terhadap PostgreSQL nyata', () => {
  test('insert, findActiveById, update, dan soft delete', async () => {
    const { userId, workspaceId } = await createOwner();
    const now = new Date('2026-05-01T00:00:00.000Z');

    const created = await seed({
      workspaceId,
      userId,
      title: 'Belajar PostgreSQL',
      description: 'Indexing',
      priority: TodoPriority.HIGH,
      dueAt: new Date('2026-05-10T02:00:00.000Z'),
      now
    });

    const found = await todoRepo.findActiveById(workspaceId, created.id);
    expect(found?.title).toBe('Belajar PostgreSQL');
    expect(found?.priority).toBe(TodoPriority.HIGH);
    expect(found?.createdAt.toISOString()).toBe(now.toISOString());

    const updated = await todoRepo.update(
      created.update(
        { title: 'Belajar advanced PostgreSQL', status: TodoStatus.COMPLETED },
        new Date('2026-05-02T00:00:00.000Z')
      )
    );

    expect(updated?.title).toBe('Belajar advanced PostgreSQL');
    expect(updated?.status).toBe(TodoStatus.COMPLETED);
    expect(updated?.completedAt?.toISOString()).toBe('2026-05-02T00:00:00.000Z');

    const deletedAt = new Date('2026-05-03T00:00:00.000Z');
    expect(await todoRepo.softDelete({ workspaceId, todoId: created.id, now: deletedAt })).toBe(true);
    expect(await todoRepo.findActiveById(workspaceId, created.id)).toBeNull();
    expect(await todoRepo.softDelete({ workspaceId, todoId: created.id, now: deletedAt })).toBe(false);

    const raw = await client.db.execute(
      sql`SELECT deleted_at FROM todos WHERE id = ${created.id}`
    );
    const rows = (raw as unknown as { rows: { deleted_at: string | Date }[] }).rows;
    const rawDeletedAt = rows[0]?.deleted_at;
    expect(rawDeletedAt).toBeDefined();
    expect(new Date(rawDeletedAt as string | Date).toISOString()).toBe(deletedAt.toISOString());
  });

  test('update menolak baris yang sudah deleted dan workspace lain', async () => {
    const { userId, workspaceId } = await createOwner();
    const { workspaceId: otherWorkspaceId, userId: otherUserId } = await createOwner();

    const todo = await seed({ workspaceId, userId, title: 'Aktif' });
    await todoRepo.softDelete({ workspaceId, todoId: todo.id, now: new Date() });

    expect(await todoRepo.update(todo.update({ title: 'Tidak boleh' }, new Date()))).toBeNull();

    const foreign = await seed({
      workspaceId: otherWorkspaceId,
      userId: otherUserId,
      title: 'Milik workspace lain'
    });

    expect(
      await todoRepo.update(
        Todo.restore({ ...foreign.toSnapshot(), workspaceId })
      )
    ).toBeNull();
  });

  test('keyset pagination deterministik dengan createdAt identik', async () => {
    const { userId, workspaceId } = await createOwner();
    const createdAt = new Date('2026-05-01T00:00:00.000Z');
    const created: string[] = [];

    for (let index = 0; index < 6; index += 1) {
      const todo = await seed({
        workspaceId,
        userId,
        title: `Same ${index}`,
        now: createdAt
      });
      created.push(todo.id);
    }

    const expected = [...created].sort((left, right) => (left < right ? 1 : left > right ? -1 : 0));
    const collected: string[] = [];
    let cursor: { createdAt: Date; id: string } | null = null;

    for (let page = 0; page < 10; page += 1) {
      const result = await listIds({ workspaceId, limit: 2, cursor });

      collected.push(...result.ids);

      if (!result.hasMore) {
        break;
      }

      if (!result.last) {
        throw new Error('Halaman dengan hasMore harus memiliki item terakhir');
      }

      cursor = { createdAt: result.last.createdAt, id: result.last.id };
    }

    expect(collected).toEqual(expected);
    expect(new Set(collected).size).toBe(6);
  });

  test('filtering status/priority/date range dan workspace isolation', async () => {
    const { userId, workspaceId } = await createOwner();
    const { workspaceId: otherWorkspaceId, userId: otherUserId } = await createOwner();

    const high = await seed({
      workspaceId,
      userId,
      title: 'High',
      priority: TodoPriority.HIGH,
      dueAt: new Date('2026-05-10T00:00:00.000Z')
    });
    const progress = await seed({
      workspaceId,
      userId,
      title: 'Progress',
      priority: TodoPriority.LOW,
      dueAt: new Date('2026-05-11T00:00:00.000Z'),
      status: TodoStatus.IN_PROGRESS
    });
    await seed({
      workspaceId,
      userId,
      title: 'Urgent',
      priority: TodoPriority.URGENT,
      dueAt: new Date('2026-05-20T00:00:00.000Z')
    });
    await seed({
      workspaceId: otherWorkspaceId,
      userId: otherUserId,
      title: 'Workspace lain',
      dueAt: new Date('2026-05-10T00:00:00.000Z')
    });

    const byPriority = await listIds({
      workspaceId,
      criteria: { priority: TodoPriority.HIGH }
    });
    expect(byPriority.ids).toEqual([high.id]);

    const byStatus = await listIds({
      workspaceId,
      criteria: { status: TodoStatus.IN_PROGRESS }
    });
    expect(byStatus.ids).toEqual([progress.id]);

    const byDueRange = await listIds({
      workspaceId,
      criteria: {
        dueAtFrom: new Date('2026-05-10T00:00:00.000Z'),
        dueAtTo: new Date('2026-05-11T00:00:00.000Z')
      }
    });
    expect(new Set(byDueRange.ids)).toEqual(new Set([high.id, progress.id]));

    const allForWorkspace = await listIds({ workspaceId });
    expect(allForWorkspace.ids).toHaveLength(3);
  });

  test('search title/description dan wildcard literal', async () => {
    const { userId, workspaceId } = await createOwner();

    const percent = await seed({ workspaceId, userId, title: 'Diskon 100% selesai' });
    await seed({ workspaceId, userId, title: 'Diskon 100x selesai' });
    const description = await seed({
      workspaceId,
      userId,
      title: 'Database',
      description: 'Membahas PostgreSQL dan indexing'
    });
    await seed({ workspaceId, userId, title: 'Redis' });

    const byTitle = await listIds({
      workspaceId,
      criteria: { search: 'postgresql' }
    });
    expect(byTitle.ids).toEqual([description.id]);

    const wildcard = await listIds({
      workspaceId,
      criteria: { search: '100%' }
    });
    expect(wildcard.ids).toEqual([percent.id]);
  });

  test('constraint database menolak status/priority/title/completedAt/FK yang tidak valid', async () => {
    const { userId, workspaceId } = await createOwner();
    const now = new Date('2026-05-01T00:00:00.000Z');

    await executeExpectingFailure(
      sql`INSERT INTO todos (workspace_id, title, status, priority, created_by, created_at, updated_at)
          VALUES (${workspaceId}, ${'Invalid status'}, ${'done'}, ${'low'}, ${userId}, ${now}, ${now})`
    );

    await executeExpectingFailure(
      sql`INSERT INTO todos (workspace_id, title, status, priority, created_by, created_at, updated_at)
          VALUES (${workspaceId}, ${'Invalid priority'}, ${'todo'}, ${'critical'}, ${userId}, ${now}, ${now})`
    );

    await executeExpectingFailure(
      sql`INSERT INTO todos (workspace_id, title, status, priority, created_by, created_at, updated_at)
          VALUES (${workspaceId}, ${'   '}, ${'todo'}, ${'low'}, ${userId}, ${now}, ${now})`
    );

    await executeExpectingFailure(
      sql`INSERT INTO todos (workspace_id, title, status, priority, completed_at, created_by, created_at, updated_at)
          VALUES (${workspaceId}, ${'Completed tanpa timestamp'}, ${'completed'}, ${'low'}, ${null}, ${userId}, ${now}, ${now})`
    );

    await executeExpectingFailure(
      sql`INSERT INTO todos (workspace_id, title, status, priority, created_by, created_at, updated_at)
          VALUES (${crypto.randomUUID()}, ${'FK workspace'}, ${'todo'}, ${'low'}, ${userId}, ${now}, ${now})`
    );

    await executeExpectingFailure(
      sql`INSERT INTO todos (workspace_id, title, status, priority, created_by, created_at, updated_at)
          VALUES (${workspaceId}, ${'FK user'}, ${'todo'}, ${'low'}, ${crypto.randomUUID()}, ${now}, ${now})`
    );
  });

  test('index dan partial index Todo tersedia di PostgreSQL', async () => {
    const result = await client.db.execute(
      sql`SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'todos'`
    );
    const rows = (result as unknown as { rows: { indexname: string; indexdef: string }[] }).rows;
    const byName = new Map(rows.map((row) => [row.indexname, row.indexdef]));

    expect(byName.has('todos_workspace_created_at_id_idx')).toBe(true);
    expect(byName.has('todos_workspace_status_created_at_id_idx')).toBe(true);
    expect(byName.has('todos_workspace_priority_created_at_id_idx')).toBe(true);
    expect(byName.has('todos_workspace_due_at_idx')).toBe(true);
    expect(byName.has('todos_workspace_deleted_at_idx')).toBe(true);

    expect(byName.get('todos_workspace_created_at_id_idx')).toInclude('deleted_at IS NULL');
    expect(byName.get('todos_workspace_due_at_idx')).toInclude('deleted_at IS NULL');
  });

  test('cursor codec yang dipakai endpoint kompatibel dengan posisi repository', async () => {
    const { userId, workspaceId } = await createOwner();
    const codec = new Base64UrlCursorCodec();
    const createdAt = new Date('2026-05-01T00:00:00.000Z');

    await seed({ workspaceId, userId, title: 'Satu', now: createdAt });
    await seed({ workspaceId, userId, title: 'Dua', now: createdAt });

    const first = await listIds({ workspaceId, limit: 1 });
    const last = first.last;

    if (!last) {
      throw new Error('Item pertama tidak ditemukan');
    }

    const fingerprint = codec.fingerprint({ kind: 'list', status: null });
    const cursor = codec.encode({
      workspaceId,
      createdAt: last.createdAt,
      id: last.id,
      fingerprint
    });
    const decoded = codec.decode(cursor, { workspaceId, fingerprint });

    const second = await listIds({ workspaceId, limit: 1, cursor: decoded });
    expect(second.ids).toHaveLength(1);
    expect(second.ids[0]).not.toBe(last.id);
  });
});
