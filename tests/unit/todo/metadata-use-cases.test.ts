import { describe, expect, test } from 'bun:test';
import { TodoError } from '../../../src/modules/todo/domain/errors/todo-error';
import { WorkspaceRole } from '../../../src/modules/workspace/domain/enums/workspace-role';
import { createTodoFixture, type TodoFixture } from '../../helpers/todo-fixtures';

function errorCodeOf(error: unknown): string | null {
  return error instanceof TodoError ? error.code : null;
}

async function captureError(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return errorCodeOf(error);
  }
}

async function setup(): Promise<TodoFixture> {
  return await createTodoFixture();
}

function addMember(fixture: TodoFixture, role: WorkspaceRole = WorkspaceRole.MEMBER): string {
  const userId = crypto.randomUUID();

  fixture.workspaceRepo.members.push({
    id: crypto.randomUUID(),
    workspaceId: fixture.workspaceId,
    userId,
    role,
    joinedAt: fixture.clock.now()
  });

  return userId;
}

async function createTag(
  fixture: TodoFixture,
  name: string,
  userId?: string
): Promise<{ id: string; name: string }> {
  return await fixture.createTag.execute({
    workspaceId: fixture.workspaceId,
    userId: userId ?? fixture.userId,
    name
  });
}

async function createLabel(
  fixture: TodoFixture,
  name = `Label ${crypto.randomUUID().slice(0, 6)}`,
  color = '#3498DB'
): Promise<{ id: string; name: string; color: string }> {
  return await fixture.createLabel.execute({
    workspaceId: fixture.workspaceId,
    userId: fixture.userId,
    name,
    color
  });
}

describe('Tag use cases', () => {
  test('create menormalkan nama dan menolak duplikat case-insensitive', async () => {
    const fixture = await setup();
    const created = await createTag(fixture, '  Kerja  ');

    expect(created.name).toBe('Kerja');
    expect(await captureError(() => createTag(fixture, 'kerja'))).toBe('TAG_ALREADY_EXISTS');
    expect(await captureError(() => createTag(fixture, '   '))).toBe('TAG_NAME_REQUIRED');
  });

  test('owner dan admin boleh mengelola tag, member ditolak 403', async () => {
    const fixture = await setup();
    const admin = addMember(fixture, WorkspaceRole.ADMIN);
    const member = addMember(fixture, WorkspaceRole.MEMBER);

    const adminTag = await createTag(fixture, 'Admin', admin);
    expect(adminTag.name).toBe('Admin');

    expect(await captureError(() => createTag(fixture, 'Member', member))).toBe(
      'WORKSPACE_PERMISSION_DENIED'
    );

    expect(
      await captureError(() =>
        fixture.updateTag.execute({
          workspaceId: fixture.workspaceId,
          userId: member,
          tagId: adminTag.id,
          name: 'Diubah member'
        })
      )
    ).toBe('WORKSPACE_PERMISSION_DENIED');

    expect(
      await captureError(() =>
        fixture.deleteTag.execute({
          workspaceId: fixture.workspaceId,
          userId: member,
          tagId: adminTag.id
        })
      )
    ).toBe('WORKSPACE_PERMISSION_DENIED');
  });

  test('update dan delete tag; tag workspace lain tidak terlihat', async () => {
    const fixture = await setup();
    const tag = await createTag(fixture, 'Lama');
    const updated = await fixture.updateTag.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      tagId: tag.id,
      name: 'Baru'
    });

    expect(updated.name).toBe('Baru');

    const otherTag = await fixture.createTag.execute({
      workspaceId: fixture.otherWorkspaceId,
      userId: fixture.otherUserId,
      name: 'Milik lain'
    });

    expect(
      await captureError(() =>
        fixture.getTag.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          tagId: otherTag.id
        })
      )
    ).toBe('TAG_NOT_FOUND');

    await fixture.deleteTag.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      tagId: tag.id
    });

    expect(
      await captureError(() =>
        fixture.getTag.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          tagId: tag.id
        })
      )
    ).toBe('TAG_NOT_FOUND');

    expect(
      await captureError(() =>
        fixture.deleteTag.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          tagId: tag.id
        })
      )
    ).toBe('TAG_NOT_FOUND');
  });

  test('delete tag menghapus association tanpa menghapus todo', async () => {
    const fixture = await setup();
    const todo = await fixture.seed();
    const tag = await createTag(fixture, 'Sementara');

    await fixture.addTodoTag.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      tagId: tag.id
    });

    await fixture.deleteTag.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      tagId: tag.id
    });

    expect(fixture.todoRepo.todos).toHaveLength(1);
    expect(await fixture.tagRepo.findByTodoIds([todo.id])).toEqual(new Map());
  });

  test('assignment tag idempoten, dibatasi 20, dan member boleh melakukan', async () => {
    const fixture = await setup();
    const member = addMember(fixture);
    const todo = await fixture.seed();
    const tags: string[] = [];

    for (let index = 0; index < 21; index += 1) {
      tags.push((await createTag(fixture, `Tag ${index}`)).id);
    }

    const first = await fixture.replaceTodoTags.execute({
      workspaceId: fixture.workspaceId,
      userId: member,
      todoId: todo.id,
      tagIds: [tags[0] as string, tags[1] as string, tags[0] as string]
    });

    expect(first.tags.map((tag) => tag.id)).toEqual([tags[0] as string, tags[1] as string]);

    const repeated = await fixture.addTodoTag.execute({
      workspaceId: fixture.workspaceId,
      userId: member,
      todoId: todo.id,
      tagId: tags[0] as string
    });

    expect(repeated.tags).toHaveLength(2);

    // Isi sampai tepat 20 tag, lalu penambahan berikutnya harus ditolak.
    await fixture.replaceTodoTags.execute({
      workspaceId: fixture.workspaceId,
      userId: member,
      todoId: todo.id,
      tagIds: tags.slice(0, 20)
    });

    expect(
      await captureError(() =>
        fixture.addTodoTag.execute({
          workspaceId: fixture.workspaceId,
          userId: member,
          todoId: todo.id,
          tagId: tags[20] as string
        })
      )
    ).toBe('TAG_LIMIT_EXCEEDED');

    const removed = await fixture.removeTodoTag.execute({
      workspaceId: fixture.workspaceId,
      userId: member,
      todoId: todo.id,
      tagId: tags[0] as string
    });

    expect(removed.tags.map((tag) => tag.id)).not.toContain(tags[0] as string);

    const repeatedRemove = await fixture.removeTodoTag.execute({
      workspaceId: fixture.workspaceId,
      userId: member,
      todoId: todo.id,
      tagId: tags[0] as string
    });

    expect(repeatedRemove.tags.map((tag) => tag.id)).not.toContain(tags[0] as string);
  });

  test('replace menolak lebih dari 20 tag dan tag dari workspace lain', async () => {
    const fixture = await setup();
    const todo = await fixture.seed();
    const many: string[] = [];

    for (let index = 0; index < 21; index += 1) {
      many.push((await createTag(fixture, `Tag ${index}`)).id);
    }

    expect(
      await captureError(() =>
        fixture.replaceTodoTags.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          tagIds: many
        })
      )
    ).toBe('TAG_LIMIT_EXCEEDED');

    const foreign = await fixture.createTag.execute({
      workspaceId: fixture.otherWorkspaceId,
      userId: fixture.otherUserId,
      name: 'Asing'
    });

    expect(
      await captureError(() =>
        fixture.replaceTodoTags.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          tagIds: [foreign.id]
        })
      )
    ).toBe('TAG_WORKSPACE_MISMATCH');
  });
});

describe('Label use cases', () => {
  test('create menormalkan warna dan menolak duplikat', async () => {
    const fixture = await setup();
    const label = await fixture.createLabel.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      name: '  Pekerjaan  ',
      color: '#aabbcc',
      description: '  Kantor  '
    });

    expect(label.name).toBe('Pekerjaan');
    expect(label.color).toBe('#AABBCC');
    expect(label.description).toBe('Kantor');

    expect(
      await captureError(() =>
        fixture.createLabel.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          name: 'pekerjaan',
          color: '#000000'
        })
      )
    ).toBe('LABEL_ALREADY_EXISTS');
  });

  test('validasi warna dan panjang deskripsi', async () => {
    const fixture = await setup();

    expect(
      await captureError(() =>
        fixture.createLabel.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          name: 'Warna',
          color: 'merah'
        })
      )
    ).toBe('LABEL_COLOR_INVALID');

    expect(
      await captureError(() =>
        fixture.createLabel.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          name: 'Deskripsi',
          color: '#000000',
          description: 'a'.repeat(301)
        })
      )
    ).toBe('LABEL_DESCRIPTION_TOO_LONG');
  });

  test('member tidak boleh mengelola label tetapi boleh assignment', async () => {
    const fixture = await setup();
    const member = addMember(fixture);
    const label = await createLabel(fixture);
    const todo = await fixture.seed();

    expect(
      await captureError(() =>
        fixture.createLabel.execute({
          workspaceId: fixture.workspaceId,
          userId: member,
          name: 'Member label',
          color: '#000000'
        })
      )
    ).toBe('WORKSPACE_PERMISSION_DENIED');

    const assigned = await fixture.assignTodoLabel.execute({
      workspaceId: fixture.workspaceId,
      userId: member,
      todoId: todo.id,
      labelId: label.id
    });

    expect(assigned.label?.id).toBe(label.id);
  });

  test('assign label mengganti label sebelumnya dan clear idempoten', async () => {
    const fixture = await setup();
    const todo = await fixture.seed();
    const first = await createLabel(fixture, 'Pertama');
    const second = await createLabel(fixture, 'Kedua');

    await fixture.assignTodoLabel.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      labelId: first.id
    });

    const replaced = await fixture.assignTodoLabel.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      labelId: second.id
    });

    expect(replaced.label?.id).toBe(second.id);

    const cleared = await fixture.clearTodoLabel.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    expect(cleared.label).toBeNull();

    const repeated = await fixture.clearTodoLabel.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    expect(repeated.label).toBeNull();
  });

  test('label workspace lain dan label tidak ada ditolak', async () => {
    const fixture = await setup();
    const todo = await fixture.seed();
    const foreign = await fixture.createLabel.execute({
      workspaceId: fixture.otherWorkspaceId,
      userId: fixture.otherUserId,
      name: 'Asing',
      color: '#000000'
    });

    expect(
      await captureError(() =>
        fixture.assignTodoLabel.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          labelId: foreign.id
        })
      )
    ).toBe('TODO_LABEL_ASSIGNMENT_INVALID');

    expect(
      await captureError(() =>
        fixture.assignTodoLabel.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          labelId: crypto.randomUUID()
        })
      )
    ).toBe('TODO_LABEL_ASSIGNMENT_INVALID');
  });

  test('delete label mengosongkan labelId todo tanpa menghapus todo', async () => {
    const fixture = await setup();
    const todo = await fixture.seed();
    const label = await createLabel(fixture, 'Akan dihapus');

    await fixture.assignTodoLabel.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      labelId: label.id
    });

    await fixture.deleteLabel.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      labelId: label.id
    });

    const stored = fixture.todoRepo.todos.find((candidate) => candidate.id === todo.id);
    expect(stored).toBeDefined();
    expect(stored?.labelId).toBeNull();

    const detail = await fixture.getTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    expect(detail.label).toBeNull();
  });
});

describe('Todo metadata response', () => {
  test('detail menyertakan label dan daftar tag', async () => {
    const fixture = await setup();
    const todo = await fixture.seed();
    const label = await createLabel(fixture, 'Utama', '#123456');
    const first = await createTag(fixture, 'Alpha');
    const second = await createTag(fixture, 'Beta');

    await fixture.assignTodoLabel.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      labelId: label.id
    });
    await fixture.replaceTodoTags.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      tagIds: [second.id, first.id]
    });

    const detail = await fixture.getTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    expect(detail.label).toEqual({ id: label.id, name: 'Utama', color: '#123456' });
    expect(new Set(detail.tags.map((tag) => tag.name))).toEqual(new Set(['Alpha', 'Beta']));
  });

  test('listing menyertakan metadata dan mendukung filter tagIds ANY serta labelId', async () => {
    const fixture = await setup();
    const labelA = await createLabel(fixture, 'A');
    const labelB = await createLabel(fixture, 'B');
    const tagX = await createTag(fixture, 'X');
    const tagY = await createTag(fixture, 'Y');

    const first = await fixture.seed({ title: 'Pertama' });
    const second = await fixture.seed({ title: 'Kedua' });
    await fixture.seed({ title: 'Tanpa metadata' });

    await fixture.assignTodoLabel.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: first.id,
      labelId: labelA.id
    });
    await fixture.assignTodoLabel.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: second.id,
      labelId: labelB.id
    });
    await fixture.addTodoTag.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: first.id,
      tagId: tagX.id
    });
    await fixture.addTodoTag.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: second.id,
      tagId: tagY.id
    });

    const byAnyTag = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      tagIds: [tagX.id, tagY.id]
    });

    expect(new Set(byAnyTag.items.map((todo) => todo.id))).toEqual(
      new Set([first.id, second.id])
    );
    expect(byAnyTag.items.find((todo) => todo.id === first.id)?.tags).toHaveLength(1);

    const byLabel = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      labelId: labelB.id
    });

    expect(byLabel.items.map((todo) => todo.id)).toEqual([second.id]);
    expect(byLabel.items[0]?.label?.id).toBe(labelB.id);
  });

  test('Today/Upcoming/Overdue mendukung filter metadata', async () => {
    const fixture = await setup();
    const label = await createLabel(fixture, 'Fokus');
    const tag = await createTag(fixture, 'Penting');

    const today = await fixture.seed({
      title: 'Hari ini',
      dueAt: new Date('2026-11-07T15:00:00.000Z')
    });
    const upcoming = await fixture.seed({
      title: 'Besok',
      dueAt: new Date('2026-11-08T10:00:00.000Z')
    });
    const overdue = await fixture.seed({
      title: 'Kemarin',
      dueAt: new Date('2026-11-06T10:00:00.000Z')
    });

    for (const todo of [today, upcoming, overdue]) {
      await fixture.addTodoTag.execute({
        workspaceId: fixture.workspaceId,
        userId: fixture.userId,
        todoId: todo.id,
        tagId: tag.id
      });
    }

    await fixture.assignTodoLabel.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: upcoming.id,
      labelId: label.id
    });

    const todayResult = await fixture.listTodayTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      tagIds: [tag.id]
    });
    expect(todayResult.items.map((todo) => todo.id)).toEqual([today.id]);

    const upcomingResult = await fixture.listUpcomingTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      labelId: label.id
    });
    expect(upcomingResult.items.map((todo) => todo.id)).toEqual([upcoming.id]);

    const overdueResult = await fixture.listOverdueTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      tagIds: [tag.id]
    });
    expect(overdueResult.items.map((todo) => todo.id)).toEqual([overdue.id]);
  });
});

describe('Cursor fingerprint metadata', () => {
  test('tagIds diurutkan sehingga urutan query tidak membedakan cursor', async () => {
    const fixture = await setup();
    const tagA = await createTag(fixture, 'A');
    const tagB = await createTag(fixture, 'B');
    const first = await fixture.seed({ title: 'Satu' });
    const second = await fixture.seed({ title: 'Dua' });

    for (const todo of [first, second]) {
      await fixture.replaceTodoTags.execute({
        workspaceId: fixture.workspaceId,
        userId: fixture.userId,
        todoId: todo.id,
        tagIds: [tagA.id, tagB.id]
      });
    }

    const page = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      limit: 1,
      tagIds: [tagA.id, tagB.id]
    });

    expect(page.pagination.nextCursor).not.toBeNull();

    const continued = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      limit: 1,
      cursor: page.pagination.nextCursor,
      tagIds: [tagB.id, tagA.id]
    });

    expect(continued.items).toHaveLength(1);
  });

  test('cursor ditolak bila filter tagIds atau labelId berubah', async () => {
    const fixture = await setup();
    const tagA = await createTag(fixture, 'A');
    const tagB = await createTag(fixture, 'B');
    const label = await createLabel(fixture, 'L');
    const first = await fixture.seed({ title: 'Satu' });
    const second = await fixture.seed({ title: 'Dua' });

    for (const todo of [first, second]) {
      await fixture.addTodoTag.execute({
        workspaceId: fixture.workspaceId,
        userId: fixture.userId,
        todoId: todo.id,
        tagId: tagA.id
      });
    }

    const page = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      limit: 1,
      tagIds: [tagA.id]
    });

    expect(
      await captureError(() =>
        fixture.listTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          limit: 1,
          cursor: page.pagination.nextCursor,
          tagIds: [tagB.id]
        })
      )
    ).toBe('INVALID_CURSOR');

    expect(
      await captureError(() =>
        fixture.listTodos.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          limit: 1,
          cursor: page.pagination.nextCursor,
          tagIds: [tagA.id],
          labelId: label.id
        })
      )
    ).toBe('INVALID_CURSOR');
  });

  test('listing memuat label dan tag dalam satu batch, bukan per todo', async () => {
    const fixture = await setup();
    let labelBatches = 0;
    let tagBatches = 0;
    const originalLabels = fixture.labelRepo.findByIds.bind(fixture.labelRepo);
    const originalTags = fixture.tagRepo.findByTodoIds.bind(fixture.tagRepo);

    fixture.labelRepo.findByIds = async (workspaceId, labelIds) => {
      labelBatches += 1;
      return await originalLabels(workspaceId, labelIds);
    };
    fixture.tagRepo.findByTodoIds = async (todoIds) => {
      tagBatches += 1;
      return await originalTags(todoIds);
    };

    const label = await fixture.createLabel.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      name: 'Work',
      color: '#2ECC71'
    });

    for (const title of ['Satu', 'Dua', 'Tiga']) {
      const todo = await fixture.seed({ title });

      await fixture.updateTodo.execute({
        workspaceId: fixture.workspaceId,
        userId: fixture.userId,
        todoId: todo.id,
        labelId: label.id
      });
    }

    labelBatches = 0;
    tagBatches = 0;

    const page = await fixture.listTodos.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId
    });

    expect(page.items).toHaveLength(3);
    expect(labelBatches).toBe(1);
    expect(tagBatches).toBe(1);
  });
});
