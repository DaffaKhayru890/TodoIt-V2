import { describe, expect, test } from 'bun:test';
import { createTodoFixture, type TodoFixture } from '../../helpers/todo-fixtures';
import { ApplicationError } from '../../../src/shared/domain/errors/application-error';
import { TodoPriority } from '../../../src/modules/todo/domain/enums/todo-priority';
import { TodoStatus } from '../../../src/modules/todo/domain/enums/todo-status';

function errorCode(run: () => Promise<unknown>): Promise<string> {
  return run().then(
    () => {
      throw new Error('Fungsi seharusnya melempar error');
    },
    (error: unknown) => {
      if (error instanceof ApplicationError) {
        return error.code;
      }

      throw error;
    }
  );
}

async function listAll(
  fixture: TodoFixture,
  limit: number,
  extra: Record<string, unknown> = {}
): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | null = null;

  for (let page = 0; page < 20; page += 1) {
    const result = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      limit,
      cursor,
      ...extra
    });

    ids.push(...result.items.map((todo) => todo.id));

    if (!result.pagination.hasMore) {
      break;
    }

    cursor = result.pagination.nextCursor;
  }

  return ids;
}

describe('Cursor pagination', () => {
  test('empty result mengembalikan items kosong dan nextCursor null', async () => {
    const fixture = await createTodoFixture();
    const result = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId
    });

    expect(result.items).toEqual([]);
    expect(result.pagination).toEqual({ limit: 20, hasMore: false, nextCursor: null });
  });

  test('halaman pertama dan berikutnya tidak duplikat dan berurutan', async () => {
    const fixture = await createTodoFixture();
    const created: string[] = [];

    for (let index = 0; index < 5; index += 1) {
      fixture.clock.advanceByMilliseconds(1_000);
      const todo = await fixture.seed({ title: `Todo ${index}` });
      created.push(todo.id);
    }

    const first = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      limit: 2
    });

    expect(first.items.map((todo) => todo.id)).toEqual([created[4]!, created[3]!]);
    expect(first.pagination.hasMore).toBe(true);
    expect(first.pagination.nextCursor).toBeString();

    const second = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      limit: 2,
      cursor: first.pagination.nextCursor
    });

    expect(second.items.map((todo) => todo.id)).toEqual([created[2]!, created[1]!]);
    expect(second.pagination.hasMore).toBe(true);

    const third = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      limit: 2,
      cursor: second.pagination.nextCursor
    });

    expect(third.items.map((todo) => todo.id)).toEqual([created[0]!]);
    expect(third.pagination.hasMore).toBe(false);
    expect(third.pagination.nextCursor).toBeNull();
  });

  test('duplicate createdAt memakai id DESC sebagai tie-breaker deterministik', async () => {
    const fixture = await createTodoFixture();
    const created: string[] = [];

    for (let index = 0; index < 6; index += 1) {
      const todo = await fixture.seed({ title: `Same time ${index}` });
      created.push(todo.id);
    }

    const expected = [...created].sort((left, right) => (left < right ? 1 : left > right ? -1 : 0));
    const actual = await listAll(fixture, 2);

    expect(actual).toEqual(expected);
    expect(new Set(actual).size).toBe(6);
  });

  test('data baru masuk selama scrolling tidak menyebabkan duplikasi', async () => {
    const fixture = await createTodoFixture();
    const firstTodo = await fixture.seed({ title: 'Lama 1' });
    fixture.clock.advanceByMilliseconds(1_000);
    const secondTodo = await fixture.seed({ title: 'Lama 2' });
    fixture.clock.advanceByMilliseconds(1_000);
    const thirdTodo = await fixture.seed({ title: 'Lama 3' });

    const firstPage = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      limit: 2
    });

    expect(firstPage.items.map((todo) => todo.id)).toEqual([thirdTodo.id, secondTodo.id]);

    fixture.clock.advanceByMilliseconds(60_000);
    const newTodo = await fixture.seed({ title: 'Baru' });

    const secondPage = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      limit: 2,
      cursor: firstPage.pagination.nextCursor
    });

    expect(secondPage.items.map((todo) => todo.id)).toEqual([firstTodo.id]);
    expect(secondPage.items.map((todo) => todo.id)).not.toContain(newTodo.id);
  });

  test('default limit 20 dan limit maksimum 100', async () => {
    const fixture = await createTodoFixture();

    for (let index = 0; index < 25; index += 1) {
      await fixture.seed();
    }

    const defaultPage = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId
    });

    expect(defaultPage.items).toHaveLength(20);
    expect(defaultPage.pagination.limit).toBe(20);
    expect(defaultPage.pagination.hasMore).toBe(true);

    const maxPage = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      limit: 100
    });

    expect(maxPage.items).toHaveLength(25);
    expect(maxPage.pagination.hasMore).toBe(false);
  });

  test('limit di luar 1..100 ditolak', async () => {
    const fixture = await createTodoFixture();

    expect(
      await errorCode(() =>
        fixture.listTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          limit: 101
        })
      )
    ).toBe('VALIDATION_ERROR');

    expect(
      await errorCode(() =>
        fixture.listTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          limit: 0
        })
      )
    ).toBe('VALIDATION_ERROR');
  });

  test('cursor invalid ditolak', async () => {
    const fixture = await createTodoFixture();

    expect(
      await errorCode(() =>
        fixture.listTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          cursor: 'cursor-palsu'
        })
      )
    ).toBe('INVALID_CURSOR');
  });

  test('cursor dari workspace lain ditolak', async () => {
    const fixture = await createTodoFixture();

    await fixture.seed({
      workspaceId: fixture.otherWorkspaceId,
      userId: fixture.otherUserId
    });
    await fixture.seed({
      workspaceId: fixture.otherWorkspaceId,
      userId: fixture.otherUserId
    });

    const otherPage = await fixture.listTodos.execute({
      workspaceId: fixture.otherWorkspaceId,
      userId: fixture.otherUserId,
      limit: 1
    });

    expect(
      await errorCode(() =>
        fixture.listTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          cursor: otherPage.pagination.nextCursor ?? undefined
        })
      )
    ).toBe('INVALID_CURSOR');
  });

  test('cursor dari filter berbeda ditolak', async () => {
    const fixture = await createTodoFixture();

    await fixture.seed({ priority: TodoPriority.HIGH });
    await fixture.seed({ priority: TodoPriority.HIGH });

    const highPage = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      limit: 1,
      priority: TodoPriority.HIGH
    });

    expect(
      await errorCode(() =>
        fixture.listTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          priority: TodoPriority.LOW,
          cursor: highPage.pagination.nextCursor ?? undefined
        })
      )
    ).toBe('INVALID_CURSOR');
  });
});

describe('Filtering', () => {
  test('filter status dan priority', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed({ title: 'Todo', priority: TodoPriority.LOW });
    const progress = await fixture.seed({ title: 'Progress', priority: TodoPriority.HIGH });

    await fixture.updateTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: progress.id,
      status: TodoStatus.IN_PROGRESS
    });

    const byStatus = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      status: TodoStatus.IN_PROGRESS
    });

    expect(byStatus.items.map((item) => item.id)).toEqual([progress.id]);

    const byPriority = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      priority: TodoPriority.LOW
    });

    expect(byPriority.items.map((item) => item.id)).toEqual([todo.id]);
  });

  test('filter dueFrom dan dueTo bersifat inclusive', async () => {
    const fixture = await createTodoFixture();
    const early = await fixture.seed({ dueAt: new Date('2026-11-08T00:00:00.000Z') });
    const middle = await fixture.seed({ dueAt: new Date('2026-11-10T00:00:00.000Z') });
    await fixture.seed({ dueAt: new Date('2026-11-12T00:00:00.000Z') });
    await fixture.seed({ dueAt: null });

    const result = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      dueFrom: new Date('2026-11-08T00:00:00.000Z'),
      dueTo: new Date('2026-11-10T00:00:00.000Z')
    });

    expect(new Set(result.items.map((item) => item.id))).toEqual(new Set([early.id, middle.id]));
  });

  test('filter createdFrom dan createdTo', async () => {
    const fixture = await createTodoFixture();
    fixture.clock.set(new Date('2026-11-01T00:00:00.000Z'));
    const early = await fixture.seed({ title: 'Awal' });
    fixture.clock.set(new Date('2026-11-05T00:00:00.000Z'));
    const middle = await fixture.seed({ title: 'Tengah' });
    fixture.clock.set(new Date('2026-11-09T00:00:00.000Z'));
    await fixture.seed({ title: 'Akhir' });

    const result = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      createdFrom: new Date('2026-11-01T00:00:00.000Z'),
      createdTo: new Date('2026-11-05T00:00:00.000Z')
    });

    expect(new Set(result.items.map((item) => item.id))).toEqual(new Set([early.id, middle.id]));
  });

  test('combined filters', async () => {
    const fixture = await createTodoFixture();
    const match = await fixture.seed({
      title: 'PostgreSQL advanced',
      priority: TodoPriority.HIGH,
      dueAt: new Date('2026-11-10T00:00:00.000Z')
    });
    await fixture.seed({
      title: 'PostgreSQL basic',
      priority: TodoPriority.LOW,
      dueAt: new Date('2026-11-10T00:00:00.000Z')
    });
    await fixture.seed({
      title: 'Redis',
      priority: TodoPriority.HIGH,
      dueAt: new Date('2026-11-10T00:00:00.000Z')
    });

    const result = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      status: TodoStatus.TODO,
      priority: TodoPriority.HIGH,
      dueFrom: new Date('2026-11-09T00:00:00.000Z'),
      dueTo: new Date('2026-11-11T00:00:00.000Z'),
      q: 'postgres'
    });

    expect(result.items.map((item) => item.id)).toEqual([match.id]);
  });

  test('search pada title dan description bersifat case-insensitive', async () => {
    const fixture = await createTodoFixture();
    const byTitle = await fixture.seed({ title: 'Belajar PostgreSQL' });
    const byDescription = await fixture.seed({
      title: 'Database',
      description: 'Membahas POSTGRESQL dan indexing'
    });
    await fixture.seed({ title: 'Redis' });

    const result = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      q: 'postgresql'
    });

    expect(new Set(result.items.map((item) => item.id))).toEqual(new Set([byTitle.id, byDescription.id]));
  });

  test('search tanpa hasil mengembalikan list kosong', async () => {
    const fixture = await createTodoFixture();
    await fixture.seed({ title: 'Belajar PostgreSQL' });

    const result = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      q: 'tidak-ada'
    });

    expect(result.items).toEqual([]);
  });

  test('wildcard % dan _ pada search diperlakukan literal', async () => {
    const fixture = await createTodoFixture();
    const percent = await fixture.seed({ title: 'Diskon 100% selesai' });
    await fixture.seed({ title: 'Diskon 100x selesai' });
    const underscore = await fixture.seed({ title: 'file_name final' });
    await fixture.seed({ title: 'fileName final' });

    const percentResult = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      q: '100%'
    });

    expect(percentResult.items.map((item) => item.id)).toEqual([percent.id]);

    const underscoreResult = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      q: 'file_name'
    });

    expect(underscoreResult.items.map((item) => item.id)).toEqual([underscore.id]);
  });

  test('date range terbalik ditolak', async () => {
    const fixture = await createTodoFixture();

    expect(
      await errorCode(() =>
        fixture.listTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          dueFrom: new Date('2026-11-12T00:00:00.000Z'),
          dueTo: new Date('2026-11-10T00:00:00.000Z')
        })
      )
    ).toBe('INVALID_DATE_RANGE');

    expect(
      await errorCode(() =>
        fixture.listTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          createdFrom: new Date('2026-11-12T00:00:00.000Z'),
          createdTo: new Date('2026-11-10T00:00:00.000Z')
        })
      )
    ).toBe('INVALID_DATE_RANGE');
  });

  test('status/priority invalid ditolak', async () => {
    const fixture = await createTodoFixture();

    expect(
      await errorCode(() =>
        fixture.listTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          status: 'done'
        })
      )
    ).toBe('TODO_STATUS_INVALID');

    expect(
      await errorCode(() =>
        fixture.listTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          priority: 'critical'
        })
      )
    ).toBe('TODO_PRIORITY_INVALID');
  });

  test('search terlalu panjang ditolak', async () => {
    const fixture = await createTodoFixture();

    expect(
      await errorCode(() =>
        fixture.listTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          q: 'a'.repeat(201)
        })
      )
    ).toBe('VALIDATION_ERROR');
  });
});
