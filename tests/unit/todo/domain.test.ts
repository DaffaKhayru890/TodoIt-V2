import { describe, expect, test } from 'bun:test';
import { Todo } from '../../../src/modules/todo/domain/entities/todo';
import { TodoStatus, isTodoStatus } from '../../../src/modules/todo/domain/enums/todo-status';
import { TodoPriority, isTodoPriority } from '../../../src/modules/todo/domain/enums/todo-priority';
import { TodoError } from '../../../src/modules/todo/domain/errors/todo-error';
import { ApplicationError } from '../../../src/shared/domain/errors/application-error';

const NOW = new Date('2026-11-07T10:00:00.000Z');
const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function errorCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ApplicationError) {
      return error.code;
    }

    throw error;
  }

  throw new Error('Fungsi seharusnya melempar error');
}

function createTodo(overrides: Partial<Parameters<typeof Todo.create>[0]> = {}): Todo {
  return Todo.create({
    id: crypto.randomUUID(),
    workspaceId: WORKSPACE_ID,
    title: 'Belajar PostgreSQL',
    createdBy: USER_ID,
    now: NOW,
    ...overrides
  });
}

describe('Todo Entity', () => {
  test('membuat todo valid dengan default status TODO, priority LOW, dan completedAt null', () => {
    const todo = createTodo();

    expect(todo.status).toBe(TodoStatus.TODO);
    expect(todo.priority).toBe(TodoPriority.LOW);
    expect(todo.dueAt).toBeNull();
    expect(todo.completedAt).toBeNull();
    expect(todo.deletedAt).toBeNull();
    expect(todo.createdAt.toISOString()).toBe(NOW.toISOString());
    expect(todo.updatedAt.toISOString()).toBe(NOW.toISOString());
    expect(todo.createdBy).toBe(USER_ID);
  });

  test('men-trim title dan menyimpan description', () => {
    const todo = createTodo({ title: '  Belajar Drizzle  ', description: '  Indexing  ' });

    expect(todo.title).toBe('Belajar Drizzle');
    expect(todo.description).toBe('Indexing');
  });

  test('menolak title kosong atau hanya whitespace dengan TODO_TITLE_REQUIRED', () => {
    expect(errorCode(() => createTodo({ title: '' }))).toBe('TODO_TITLE_REQUIRED');
    expect(errorCode(() => createTodo({ title: '    ' }))).toBe('TODO_TITLE_REQUIRED');
  });

  test('menolak title lebih dari 200 karakter dengan TODO_TITLE_TOO_LONG', () => {
    expect(errorCode(() => createTodo({ title: 'a'.repeat(201) }))).toBe('TODO_TITLE_TOO_LONG');
  });

  test('menerima title tepat 200 karakter', () => {
    expect(createTodo({ title: 'a'.repeat(200) }).title.length).toBe(200);
  });

  test('menolak description lebih dari 5000 karakter', () => {
    expect(errorCode(() => createTodo({ description: 'a'.repeat(5001) }))).toBe(
      'TODO_DESCRIPTION_TOO_LONG'
    );
  });

  test('description kosong dinormalisasi menjadi null', () => {
    expect(createTodo({ description: '   ' }).description).toBeNull();
  });

  test('due date opsional dan boleh null', () => {
    expect(createTodo().dueAt).toBeNull();

    const withDue = createTodo({ dueAt: new Date('2026-11-10T02:00:00.000Z') });
    expect(withDue.dueAt?.toISOString()).toBe('2026-11-10T02:00:00.000Z');
  });

  test('menolak due date yang bukan tanggal valid', () => {
    expect(errorCode(() => createTodo({ dueAt: new Date('tidak-valid') }))).toBe('VALIDATION_ERROR');
  });

  test('menolak priority di luar enum', () => {
    expect(errorCode(() => createTodo({ priority: 'critical' as TodoPriority }))).toBe(
      'TODO_PRIORITY_INVALID'
    );
  });

  test('update mengubah field dan updatedAt tanpa menggeser createdAt', () => {
    const todo = createTodo();
    const later = new Date('2026-11-07T11:00:00.000Z');
    const updated = todo.update(
      {
        title: 'Belajar Advanced PostgreSQL',
        description: 'Index dan transaksi',
        priority: TodoPriority.URGENT,
        dueAt: new Date('2026-11-12T02:00:00.000Z')
      },
      later
    );

    expect(updated.title).toBe('Belajar Advanced PostgreSQL');
    expect(updated.description).toBe('Index dan transaksi');
    expect(updated.priority).toBe(TodoPriority.URGENT);
    expect(updated.dueAt?.toISOString()).toBe('2026-11-12T02:00:00.000Z');
    expect(updated.createdAt.toISOString()).toBe(NOW.toISOString());
    expect(updated.updatedAt.toISOString()).toBe(later.toISOString());
    // Entity immutable: instance lama tidak berubah.
    expect(todo.title).toBe('Belajar PostgreSQL');
  });

  test('description dan dueAt dapat dihapus dengan null', () => {
    const todo = createTodo({
      description: 'Ada isi',
      dueAt: new Date('2026-11-10T02:00:00.000Z')
    });
    const updated = todo.update({ description: null, dueAt: null }, new Date());

    expect(updated.description).toBeNull();
    expect(updated.dueAt).toBeNull();
  });

  test('status completed mengisi completedAt dengan waktu server', () => {
    const completedAt = new Date('2026-11-07T12:00:00.000Z');
    const completed = createTodo().update({ status: TodoStatus.COMPLETED }, completedAt);

    expect(completed.status).toBe(TodoStatus.COMPLETED);
    expect(completed.completedAt?.toISOString()).toBe(completedAt.toISOString());
    expect(completed.updatedAt.toISOString()).toBe(completedAt.toISOString());
    expect(completed.createdAt.toISOString()).toBe(NOW.toISOString());
  });

  test('membuka kembali todo completed mengosongkan completedAt', () => {
    const completed = createTodo().complete(new Date('2026-11-07T12:00:00.000Z'));
    const reopened = completed.update(
      { status: TodoStatus.IN_PROGRESS },
      new Date('2026-11-07T13:00:00.000Z')
    );

    expect(reopened.status).toBe(TodoStatus.IN_PROGRESS);
    expect(reopened.completedAt).toBeNull();
  });

  test('status cancelled tidak boleh menyimpan completedAt', () => {
    const completed = createTodo().complete(new Date('2026-11-07T12:00:00.000Z'));
    const cancelled = completed.update(
      { status: TodoStatus.CANCELLED },
      new Date('2026-11-07T13:00:00.000Z')
    );

    expect(cancelled.completedAt).toBeNull();
  });

  test('memperbarui todo yang tetap completed mempertahankan completedAt', () => {
    const completedAt = new Date('2026-11-07T12:00:00.000Z');
    const completed = createTodo().complete(completedAt);
    const renamed = completed.update(
      { title: 'Judul baru' },
      new Date('2026-11-07T13:00:00.000Z')
    );

    expect(renamed.status).toBe(TodoStatus.COMPLETED);
    expect(renamed.completedAt?.toISOString()).toBe(completedAt.toISOString());
  });

  test('complete bersifat idempoten dan tidak menggeser timestamp', () => {
    const completedAt = new Date('2026-11-07T12:00:00.000Z');
    const completed = createTodo().complete(completedAt);
    const repeated = completed.complete(new Date('2026-11-07T15:00:00.000Z'));

    expect(repeated).toBe(completed);
    expect(repeated.completedAt?.toISOString()).toBe(completedAt.toISOString());
    expect(repeated.updatedAt.toISOString()).toBe(completedAt.toISOString());
  });

  test('soft delete mengisi deletedAt dan todo terhapus tidak dapat diubah/diselesaikan', () => {
    const deletedAt = new Date('2026-11-07T14:00:00.000Z');
    const deleted = createTodo().softDelete(deletedAt);

    expect(deleted.isDeleted).toBe(true);
    expect(deleted.deletedAt?.toISOString()).toBe(deletedAt.toISOString());
    expect(errorCode(() => deleted.update({ title: 'X' }, new Date()))).toBe('TODO_NOT_FOUND');
    expect(errorCode(() => deleted.complete(new Date()))).toBe('TODO_NOT_FOUND');
  });

  test('soft delete bersifat idempoten', () => {
    const deleted = createTodo().softDelete(new Date('2026-11-07T14:00:00.000Z'));
    const repeated = deleted.softDelete(new Date('2026-11-07T15:00:00.000Z'));

    expect(repeated).toBe(deleted);
  });

  test('restore menolak status tanpa completedAt yang konsisten', () => {
    expect(() =>
      Todo.restore({
        id: crypto.randomUUID(),
        workspaceId: WORKSPACE_ID,
        title: 'X',
        description: null,
        status: TodoStatus.COMPLETED,
        priority: TodoPriority.LOW,
        dueAt: null,
        completedAt: null,
        createdBy: USER_ID,
        createdAt: NOW,
        updatedAt: NOW,
        deletedAt: null
      })
    ).toThrow(TodoError);
  });
});

describe('Todo Status', () => {
  test('seluruh status valid dikenali', () => {
    for (const status of ['todo', 'in_progress', 'completed', 'cancelled']) {
      expect(isTodoStatus(status)).toBe(true);
    }
  });

  test('status tidak dikenal ditolak', () => {
    expect(isTodoStatus('done')).toBe(false);
    expect(errorCode(() => createTodo().update({ status: 'done' as TodoStatus }, new Date()))).toBe(
      'TODO_STATUS_INVALID'
    );
  });
});

describe('Todo Priority', () => {
  test('seluruh priority valid dikenali', () => {
    for (const priority of ['low', 'medium', 'high', 'urgent']) {
      expect(isTodoPriority(priority)).toBe(true);
    }
  });

  test('priority tidak dikenal ditolak', () => {
    expect(isTodoPriority('critical')).toBe(false);
    expect(errorCode(() => createTodo().update({ priority: 'critical' as TodoPriority }, new Date()))).toBe(
      'TODO_PRIORITY_INVALID'
    );
  });
});
