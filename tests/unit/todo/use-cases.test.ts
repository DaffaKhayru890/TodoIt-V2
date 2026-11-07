import { describe, expect, test } from 'bun:test';
import { createTodoFixture } from '../../helpers/todo-fixtures';
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

const ONE_HOUR = 3_600_000;

describe('CreateTodo', () => {
  test('membuat todo valid dengan metadata dari server', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed({ title: '  Belajar PostgreSQL  ', description: 'Indexing' });

    expect(todo.title).toBe('Belajar PostgreSQL');
    expect(todo.description).toBe('Indexing');
    expect(todo.status).toBe('todo');
    expect(todo.priority).toBe('low');
    expect(todo.workspaceId).toBe(fixture.workspaceId);
    expect(todo.createdBy).toBe(fixture.userId);
    expect(todo.createdAt.toISOString()).toBe(fixture.clock.now().toISOString());
    expect(todo.updatedAt.toISOString()).toBe(fixture.clock.now().toISOString());
  });

  test('membuat todo tanpa description dan due date', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.createTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      title: 'Tanpa deskripsi'
    });

    expect(todo.description).toBeNull();
    expect(todo.dueAt).toBeNull();
  });

  test('menghormati priority yang diberikan', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed({ priority: 'urgent' });

    expect(todo.priority).toBe('urgent');
  });

  test('menolak title invalid', async () => {
    const fixture = await createTodoFixture();

    expect(
      await errorCode(() =>
        fixture.createTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          title: '   '
        })
      )
    ).toBe('TODO_TITLE_REQUIRED');

    expect(
      await errorCode(() =>
        fixture.createTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          title: 'a'.repeat(201)
        })
      )
    ).toBe('TODO_TITLE_TOO_LONG');
  });

  test('menolak priority invalid', async () => {
    const fixture = await createTodoFixture();

    expect(
      await errorCode(() =>
        fixture.createTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          title: 'Valid',
          priority: 'critical'
        })
      )
    ).toBe('TODO_PRIORITY_INVALID');
  });

  test('menolak due date invalid', async () => {
    const fixture = await createTodoFixture();

    expect(
      await errorCode(() =>
        fixture.createTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          title: 'Valid',
          dueAt: new Date('bukan-tanggal')
        })
      )
    ).toBe('VALIDATION_ERROR');
  });

  test('user bukan member workspace ditolak', async () => {
    const fixture = await createTodoFixture();

    expect(
      await errorCode(() =>
        fixture.createTodo.execute({
          workspaceId: fixture.otherWorkspaceId,
          userId: fixture.userId,
          title: 'Cross workspace'
        })
      )
    ).toBe('WORKSPACE_ACCESS_DENIED');
  });

  test('workspace tidak ditemukan menghasilkan WORKSPACE_ACCESS_DENIED', async () => {
    const fixture = await createTodoFixture();

    expect(
      await errorCode(() =>
        fixture.createTodo.execute({
          workspaceId: crypto.randomUUID(),
          userId: fixture.userId,
          title: 'Workspace hantu'
        })
      )
    ).toBe('WORKSPACE_ACCESS_DENIED');
  });

  test('workspace yang diarsipkan tidak dapat menerima todo baru', async () => {
    const fixture = await createTodoFixture();
    const workspace = fixture.workspaceRepo.workspaces[0];

    if (!workspace) {
      throw new Error('Workspace fixture tidak ditemukan');
    }

    fixture.workspaceRepo.workspaces[0] = { ...workspace, archivedAt: fixture.clock.now() };

    expect(
      await errorCode(() =>
        fixture.createTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          title: 'Tidak boleh'
        })
      )
    ).toBe('WORKSPACE_ACCESS_DENIED');
  });
});

describe('GetTodo', () => {
  test('mengambil todo aktif', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed({ title: 'Ambil saya' });
    const found = await fixture.getTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    expect(found.id).toBe(todo.id);
    expect(found.title).toBe('Ambil saya');
  });

  test('todo yang dihapus atau tidak ada menghasilkan TODO_NOT_FOUND', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed();
    await fixture.deleteTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    expect(
      await errorCode(() =>
        fixture.getTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id
        })
      )
    ).toBe('TODO_NOT_FOUND');

    expect(
      await errorCode(() =>
        fixture.getTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: crypto.randomUUID()
        })
      )
    ).toBe('TODO_NOT_FOUND');
  });

  test('cross-workspace access ditolak', async () => {
    const fixture = await createTodoFixture();
    const otherTodo = await fixture.seed({
      workspaceId: fixture.otherWorkspaceId,
      userId: fixture.otherUserId
    });

    expect(
      await errorCode(() =>
        fixture.getTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: otherTodo.id
        })
      )
    ).toBe('TODO_NOT_FOUND');
  });
});

describe('UpdateTodo', () => {
  test('memperbarui title, description, priority, dan dueAt', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed();
    fixture.clock.advanceByMilliseconds(ONE_HOUR);

    const updated = await fixture.updateTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      title: 'Judul baru',
      description: 'Deskripsi baru',
      priority: 'high',
      dueAt: new Date('2026-11-12T02:00:00.000Z')
    });

    expect(updated.title).toBe('Judul baru');
    expect(updated.description).toBe('Deskripsi baru');
    expect(updated.priority).toBe('high');
    expect(updated.dueAt?.toISOString()).toBe('2026-11-12T02:00:00.000Z');
    expect(updated.createdAt.toISOString()).toBe(todo.createdAt.toISOString());
    expect(updated.createdBy).toBe(todo.createdBy);
    expect(updated.workspaceId).toBe(todo.workspaceId);
    expect(updated.updatedAt.toISOString()).toBe(fixture.clock.now().toISOString());
  });

  test('null menghapus description dan dueAt', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed({
      description: 'Hapus saya',
      dueAt: new Date('2026-11-10T02:00:00.000Z')
    });

    const updated = await fixture.updateTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      description: null,
      dueAt: null
    });

    expect(updated.description).toBeNull();
    expect(updated.dueAt).toBeNull();
  });

  test('status completed mengisi completedAt dari clock', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed();
    fixture.clock.advanceByMilliseconds(2 * ONE_HOUR);

    const updated = await fixture.updateTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      status: 'completed'
    });

    expect(updated.status).toBe('completed');
    expect(updated.completedAt?.toISOString()).toBe(fixture.clock.now().toISOString());
  });

  test('reopen completed mengosongkan completedAt', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed();
    await fixture.completeTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    const reopened = await fixture.updateTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      status: 'in_progress'
    });

    expect(reopened.status).toBe('in_progress');
    expect(reopened.completedAt).toBeNull();
  });

  test('status cancelled tidak memiliki completedAt', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed();

    const cancelled = await fixture.updateTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      status: 'cancelled'
    });

    expect(cancelled.completedAt).toBeNull();
  });

  test('request tanpa field yang dapat diubah ditolak', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed();

    expect(
      await errorCode(() =>
        fixture.updateTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id
        })
      )
    ).toBe('VALIDATION_ERROR');
  });

  test('status/priority invalid ditolak', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed();

    expect(
      await errorCode(() =>
        fixture.updateTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          status: 'done'
        })
      )
    ).toBe('TODO_STATUS_INVALID');

    expect(
      await errorCode(() =>
        fixture.updateTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          priority: 'critical'
        })
      )
    ).toBe('TODO_PRIORITY_INVALID');
  });

  test('todo deleted tidak dapat di-update', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed();
    await fixture.deleteTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    expect(
      await errorCode(() =>
        fixture.updateTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          title: 'Tidak boleh'
        })
      )
    ).toBe('TODO_NOT_FOUND');
  });

  test('cross-workspace update tidak menemukan todo', async () => {
    const fixture = await createTodoFixture();
    const otherTodo = await fixture.seed({
      workspaceId: fixture.otherWorkspaceId,
      userId: fixture.otherUserId
    });

    expect(
      await errorCode(() =>
        fixture.updateTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: otherTodo.id,
          title: 'Hijack'
        })
      )
    ).toBe('TODO_NOT_FOUND');
  });
});

describe('DeleteTodo', () => {
  test('soft delete mengisi deletedAt, menyembunyikan dari listing, dan tidak menghapus record', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed();
    fixture.clock.advanceByMilliseconds(ONE_HOUR);

    await fixture.deleteTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    const stored = fixture.todoRepo.todos.find((candidate) => candidate.id === todo.id);

    expect(stored?.isDeleted).toBe(true);
    expect(stored?.deletedAt?.toISOString()).toBe(fixture.clock.now().toISOString());
    expect(stored?.updatedAt.toISOString()).toBe(fixture.clock.now().toISOString());

    const list = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId
    });

    expect(list.items).toHaveLength(0);
  });

  test('delete idempoten dan tidak melempar untuk todo yang sudah terhapus', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed();

    await fixture.deleteTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    await expect(
      fixture.deleteTodo.execute({
        workspaceId: fixture.workspaceId,
        userId: fixture.userId,
        todoId: todo.id
      })
    ).resolves.toBeUndefined();
  });

  test('user bukan member workspace ditolak', async () => {
    const fixture = await createTodoFixture();

    expect(
      await errorCode(() =>
        fixture.deleteTodo.execute({
          workspaceId: fixture.otherWorkspaceId,
          userId: fixture.userId,
          todoId: crypto.randomUUID()
        })
      )
    ).toBe('WORKSPACE_ACCESS_DENIED');
  });
});

describe('CompleteTodo', () => {
  test('menyelesaikan todo dan mengisi completedAt', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed();
    fixture.clock.advanceByMilliseconds(ONE_HOUR);

    const completed = await fixture.completeTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    expect(completed.status).toBe('completed');
    expect(completed.completedAt?.toISOString()).toBe(fixture.clock.now().toISOString());
    expect(completed.updatedAt.toISOString()).toBe(fixture.clock.now().toISOString());
  });

  test('complete idempoten: timestamp tidak bergeser pada pemanggilan kedua', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed();

    const first = await fixture.completeTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    fixture.clock.advanceByMilliseconds(ONE_HOUR);

    const second = await fixture.completeTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    expect(second.completedAt?.toISOString()).toBe(first.completedAt?.toISOString());
    expect(second.updatedAt.toISOString()).toBe(first.updatedAt.toISOString());
  });

  test('todo deleted tidak dapat diselesaikan', async () => {
    const fixture = await createTodoFixture();
    const todo = await fixture.seed();
    await fixture.deleteTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    expect(
      await errorCode(() =>
        fixture.completeTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id
        })
      )
    ).toBe('TODO_NOT_FOUND');
  });
});
