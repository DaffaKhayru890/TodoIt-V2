import { describe, expect, test } from 'bun:test';
import { createTodoFixture, type TodoFixture } from '../../helpers/todo-fixtures';
import { ApplicationError } from '../../../src/shared/domain/errors/application-error';

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

async function complete(fixture: TodoFixture, todoId: string): Promise<void> {
  await fixture.completeTodo.execute({
    workspaceId: fixture.workspaceId,
    userId: fixture.userId,
    todoId
  });
}

async function cancel(fixture: TodoFixture, todoId: string): Promise<void> {
  await fixture.updateTodo.execute({
    workspaceId: fixture.workspaceId,
    userId: fixture.userId,
    todoId,
    status: 'cancelled'
  });
}

async function remove(fixture: TodoFixture, todoId: string): Promise<void> {
  await fixture.deleteTodo.execute({
    workspaceId: fixture.workspaceId,
    userId: fixture.userId,
    todoId
  });
}

describe('Today View', () => {
  test('UTC: hanya dueAt pada hari ini, batas interval benar, dan exclude status yang tidak sesuai', async () => {
    const fixture = await createTodoFixture();

    const atStart = await fixture.seed({ title: 'Awal hari', dueAt: new Date('2026-11-07T00:00:00.000Z') });
    const beforeEnd = await fixture.seed({
      title: 'Sebelum akhir hari',
      dueAt: new Date('2026-11-07T23:59:59.999Z')
    });
    const yesterday = await fixture.seed({ title: 'Kemarin', dueAt: new Date('2026-11-06T23:59:59.999Z') });
    const tomorrow = await fixture.seed({ title: 'Besok', dueAt: new Date('2026-11-08T00:00:00.000Z') });
    const noDue = await fixture.seed({ title: 'Tanpa due' });
    const completed = await fixture.seed({ title: 'Selesai', dueAt: new Date('2026-11-07T09:00:00.000Z') });
    const cancelled = await fixture.seed({ title: 'Batal', dueAt: new Date('2026-11-07T09:00:00.000Z') });
    const deleted = await fixture.seed({ title: 'Hapus', dueAt: new Date('2026-11-07T09:00:00.000Z') });

    await complete(fixture, completed.id);
    await cancel(fixture, cancelled.id);
    await remove(fixture, deleted.id);

    const result = await fixture.listTodayTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC'
    });

    const ids = new Set(result.items.map((todo) => todo.id));

    expect(ids).toEqual(new Set([atStart.id, beforeEnd.id]));
    expect(ids.has(yesterday.id)).toBe(false);
    expect(ids.has(tomorrow.id)).toBe(false);
    expect(ids.has(noDue.id)).toBe(false);
    expect(ids.has(completed.id)).toBe(false);
    expect(ids.has(cancelled.id)).toBe(false);
    expect(ids.has(deleted.id)).toBe(false);
  });

  test('includeCompleted=true menyertakan completed tetapi tetap mengecualikan cancelled', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed({ title: 'Aktif', dueAt: new Date('2026-11-07T09:00:00.000Z') });
    const completed = await fixture.seed({ title: 'Selesai', dueAt: new Date('2026-11-07T09:00:00.000Z') });
    const cancelled = await fixture.seed({ title: 'Batal', dueAt: new Date('2026-11-07T09:00:00.000Z') });

    await complete(fixture, completed.id);
    await cancel(fixture, cancelled.id);

    const result = await fixture.listTodayTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC',
      includeCompleted: true
    });

    expect(new Set(result.items.map((item) => item.id))).toEqual(new Set([todo.id, completed.id]));
  });

  test('Asia/Jakarta memakai batas hari lokal, bukan UTC', async () => {
    const fixture = await createTodoFixture();

    // 01:00 tanggal 8 November di Jakarta, tetapi masih 7 November UTC.
    const jakartaNextDay = await fixture.seed({
      title: 'Dini hari Jakarta',
      dueAt: new Date('2026-11-07T18:00:00.000Z')
    });
    const jakartaToday = await fixture.seed({
      title: 'Sore Jakarta',
      dueAt: new Date('2026-11-07T10:00:00.000Z')
    });

    const jakarta = await fixture.listTodayTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'Asia/Jakarta'
    });
    const utc = await fixture.listTodayTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC'
    });

    expect(jakarta.items.map((item) => item.id)).toEqual([jakartaToday.id]);
    expect(new Set(utc.items.map((item) => item.id))).toEqual(
      new Set([jakartaNextDay.id, jakartaToday.id])
    );
  });

  test('default timezone mengikuti konfigurasi aplikasi', async () => {
    const fixture = await createTodoFixture({ defaultTimezone: 'Asia/Jakarta' });
    const todo = await fixture.seed({
      title: 'Sore Jakarta',
      dueAt: new Date('2026-11-07T10:00:00.000Z')
    });

    const result = await fixture.listTodayTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId
    });

    expect(result.items.map((item) => item.id)).toEqual([todo.id]);
  });

  test('todo yang dibuat hari ini tanpa due date tidak masuk Today', async () => {
    const fixture = await createTodoFixture();
    const createdToday = await fixture.seed({ title: 'Dibuat hari ini' });

    const result = await fixture.listTodayTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC'
    });

    expect(result.items.map((item) => item.id)).not.toContain(createdToday.id);
  });

  test('timezone invalid ditolak', async () => {
    const fixture = await createTodoFixture();

    expect(
      await errorCode(() =>
        fixture.listTodayTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          timezone: 'Asia/Jakarta+7'
        })
      )
    ).toBe('INVALID_TIMEZONE');
  });

  test('paginate Today dengan cursor yang sama seperti listing', async () => {
    const fixture = await createTodoFixture();
    const created: string[] = [];

    for (let index = 0; index < 3; index += 1) {
      fixture.clock.advanceByMilliseconds(1_000);
      const todo = await fixture.seed({
        title: `Hari ini ${index}`,
        dueAt: new Date('2026-11-07T09:00:00.000Z')
      });
      created.push(todo.id);
    }

    const first = await fixture.listTodayTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC',
      limit: 2
    });

    expect(first.items.map((item) => item.id)).toEqual([created[2]!, created[1]!]);
    expect(first.pagination.hasMore).toBe(true);

    const second = await fixture.listTodayTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC',
      limit: 2,
      cursor: first.pagination.nextCursor
    });

    expect(second.items.map((item) => item.id)).toEqual([created[0]!]);
    expect(second.pagination.hasMore).toBe(false);
  });
});

describe('Upcoming View', () => {
  test('default 7 hari: besok sampai hari ke-7, exclude hari ini dan di luar rentang', async () => {
    const fixture = await createTodoFixture();
    const today = await fixture.seed({ title: 'Hari ini', dueAt: new Date('2026-11-07T09:00:00.000Z') });
    const tomorrow = await fixture.seed({ title: 'Besok', dueAt: new Date('2026-11-08T00:00:00.000Z') });
    const daySeven = await fixture.seed({ title: 'Hari ke-7', dueAt: new Date('2026-11-14T23:59:59.999Z') });
    const dayEight = await fixture.seed({ title: 'Hari ke-8', dueAt: new Date('2026-11-15T00:00:00.000Z') });
    const noDue = await fixture.seed({ title: 'Tanpa due' });

    const result = await fixture.listUpcomingTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC'
    });

    const ids = new Set(result.items.map((item) => item.id));

    expect(ids).toEqual(new Set([tomorrow.id, daySeven.id]));
    expect(ids.has(today.id)).toBe(false);
    expect(ids.has(dayEight.id)).toBe(false);
    expect(ids.has(noDue.id)).toBe(false);
  });

  test('custom days dan validasi 1..30', async () => {
    const fixture = await createTodoFixture();
    const tomorrow = await fixture.seed({ title: 'Besok', dueAt: new Date('2026-11-08T12:00:00.000Z') });
    const dayAfterTomorrow = await fixture.seed({ title: 'Lusa', dueAt: new Date('2026-11-09T12:00:00.000Z') });

    const oneDay = await fixture.listUpcomingTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC',
      days: 1
    });

    expect(oneDay.items.map((item) => item.id)).toEqual([tomorrow.id]);
    expect(oneDay.items.map((item) => item.id)).not.toContain(dayAfterTomorrow.id);

    expect(
      await errorCode(() =>
        fixture.listUpcomingTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          timezone: 'UTC',
          days: 0
        })
      )
    ).toBe('INVALID_UPCOMING_RANGE');

    expect(
      await errorCode(() =>
        fixture.listUpcomingTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          timezone: 'UTC',
          days: 31
        })
      )
    ).toBe('INVALID_UPCOMING_RANGE');
  });

  test('completed, cancelled, dan deleted tidak masuk Upcoming', async () => {
    const fixture = await createTodoFixture();
    const active = await fixture.seed({ title: 'Aktif', dueAt: new Date('2026-11-09T09:00:00.000Z') });
    const completed = await fixture.seed({ title: 'Selesai', dueAt: new Date('2026-11-09T09:00:00.000Z') });
    const cancelled = await fixture.seed({ title: 'Batal', dueAt: new Date('2026-11-09T09:00:00.000Z') });
    const deleted = await fixture.seed({ title: 'Hapus', dueAt: new Date('2026-11-09T09:00:00.000Z') });

    await complete(fixture, completed.id);
    await cancel(fixture, cancelled.id);
    await remove(fixture, deleted.id);

    const result = await fixture.listUpcomingTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC'
    });

    expect(result.items.map((item) => item.id)).toEqual([active.id]);
  });

  test('Upcoming berdasarkan timezone pengguna', async () => {
    const fixture = await createTodoFixture();
    // 01:00 tanggal 8 November di Jakarta = 18:00Z tanggal 7 November.
    const jakartaTomorrow = await fixture.seed({
      title: 'Besok Jakarta',
      dueAt: new Date('2026-11-07T18:00:00.000Z')
    });

    const jakarta = await fixture.listUpcomingTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'Asia/Jakarta',
      days: 1
    });
    const utc = await fixture.listUpcomingTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC',
      days: 1
    });

    expect(jakarta.items.map((item) => item.id)).toEqual([jakartaTomorrow.id]);
    // Di UTC, 18:00Z tanggal 7 November masih tanggal 7 (hari ini), bukan upcoming.
    expect(utc.items).toEqual([]);
  });

  test('paginate Upcoming', async () => {
    const fixture = await createTodoFixture();
    const created: string[] = [];

    for (let index = 0; index < 3; index += 1) {
      fixture.clock.advanceByMilliseconds(1_000);
      const todo = await fixture.seed({
        title: `Upcoming ${index}`,
        dueAt: new Date('2026-11-09T09:00:00.000Z')
      });
      created.push(todo.id);
    }

    const first = await fixture.listUpcomingTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC',
      limit: 2
    });

    expect(first.items.map((item) => item.id)).toEqual([created[2]!, created[1]!]);
    expect(first.pagination.hasMore).toBe(true);

    const second = await fixture.listUpcomingTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC',
      limit: 2,
      cursor: first.pagination.nextCursor
    });

    expect(second.items.map((item) => item.id)).toEqual([created[0]!]);
    expect(second.pagination.hasMore).toBe(false);
  });
});

describe('Overdue View', () => {
  test('hanya dueAt sebelum awal hari ini dan belum selesai/dibatalkan', async () => {
    const fixture = await createTodoFixture();
    const yesterday = await fixture.seed({ title: 'Kemarin', dueAt: new Date('2026-11-06T23:59:59.999Z') });
    const todayStart = await fixture.seed({ title: 'Awal hari ini', dueAt: new Date('2026-11-07T00:00:00.000Z') });
    const tomorrow = await fixture.seed({ title: 'Besok', dueAt: new Date('2026-11-08T00:00:00.000Z') });
    const noDue = await fixture.seed({ title: 'Tanpa due' });
    const completed = await fixture.seed({ title: 'Selesai', dueAt: new Date('2026-11-06T10:00:00.000Z') });
    const cancelled = await fixture.seed({ title: 'Batal', dueAt: new Date('2026-11-06T10:00:00.000Z') });
    const deleted = await fixture.seed({ title: 'Hapus', dueAt: new Date('2026-11-06T10:00:00.000Z') });

    await complete(fixture, completed.id);
    await cancel(fixture, cancelled.id);
    await remove(fixture, deleted.id);

    const result = await fixture.listOverdueTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC'
    });

    const ids = new Set(result.items.map((item) => item.id));

    expect(ids).toEqual(new Set([yesterday.id]));
    expect(ids.has(todayStart.id)).toBe(false);
    expect(ids.has(tomorrow.id)).toBe(false);
    expect(ids.has(noDue.id)).toBe(false);
    expect(ids.has(completed.id)).toBe(false);
    expect(ids.has(cancelled.id)).toBe(false);
    expect(ids.has(deleted.id)).toBe(false);
  });

  test('overdue mengikuti timezone: 18:00Z tanggal 6 sudah overdue di UTC, belum di Jakarta', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed({
      title: 'Lewat tengah malam Jakarta',
      dueAt: new Date('2026-11-06T18:00:00.000Z')
    });

    const jakarta = await fixture.listOverdueTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'Asia/Jakarta'
    });
    const utc = await fixture.listOverdueTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC'
    });

    expect(jakarta.items.map((item) => item.id)).toEqual([]);
    expect(utc.items.map((item) => item.id)).toEqual([todo.id]);
  });

  test('overdue tidak mengubah status todo secara otomatis', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed({ title: 'Terlambat', dueAt: new Date('2026-11-01T09:00:00.000Z') });

    await fixture.listOverdueTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC'
    });

    const found = await fixture.getTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    expect(found.status).toBe('todo');
  });

  test('paginate Overdue', async () => {
    const fixture = await createTodoFixture();
    const created: string[] = [];

    for (let index = 0; index < 3; index += 1) {
      fixture.clock.advanceByMilliseconds(1_000);
      const todo = await fixture.seed({
        title: `Overdue ${index}`,
        dueAt: new Date('2026-11-05T09:00:00.000Z')
      });
      created.push(todo.id);
    }

    const first = await fixture.listOverdueTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC',
      limit: 2
    });

    expect(first.items.map((item) => item.id)).toEqual([created[2]!, created[1]!]);
    expect(first.pagination.hasMore).toBe(true);

    const second = await fixture.listOverdueTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      timezone: 'UTC',
      limit: 2,
      cursor: first.pagination.nextCursor
    });

    expect(second.items.map((item) => item.id)).toEqual([created[0]!]);
    expect(second.pagination.hasMore).toBe(false);
  });
});
