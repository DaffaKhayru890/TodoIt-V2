import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { eq, sql } from 'drizzle-orm';
import { loadAppConfig } from '../../src/config/app-config';
import { FixedClock } from '../../src/shared/domain/clock';
import { createDatabaseClient, type DatabaseClient } from '../../src/shared/infrastructure/database/client';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { DrizzleAuthRepository } from '../../src/modules/auth/infrastructure/persistence/drizzle-auth.repository';
import { toEmail } from '../../src/modules/auth/domain/value-objects/email';
import { DrizzleWorkspaceRepository } from '../../src/modules/workspace/infrastructure/persistence/drizzle-workspace.repository';
import { Todo } from '../../src/modules/todo/domain/entities/todo';
import { Tag } from '../../src/modules/todo/domain/entities/tag';
import { Label } from '../../src/modules/todo/domain/entities/label';
import { Reminder } from '../../src/modules/todo/domain/entities/reminder';
import { ReminderTriggerType } from '../../src/modules/todo/domain/enums/reminder-trigger-type';
import { TodoError } from '../../src/modules/todo/domain/errors/todo-error';
import { TodoAccessService } from '../../src/modules/todo/application/services/todo-access.service';
import { DrizzleTodoRepository } from '../../src/modules/todo/infrastructure/persistence/drizzle-todo.repository';
import { DrizzleTagRepository } from '../../src/modules/todo/infrastructure/persistence/drizzle-tag.repository';
import { DrizzleLabelRepository } from '../../src/modules/todo/infrastructure/persistence/drizzle-label.repository';
import { DrizzleReminderRepository } from '../../src/modules/todo/infrastructure/persistence/drizzle-reminder.repository';
import { DrizzleTodoUnitOfWork } from '../../src/modules/todo/infrastructure/persistence/drizzle-todo-unit-of-work';
import { labels } from '../../src/modules/todo/infrastructure/persistence/label.schema';
import { todoTags } from '../../src/modules/todo/infrastructure/persistence/todo-tag.schema';
import { todos } from '../../src/modules/todo/infrastructure/persistence/todo.schema';
import { CreateReminder } from '../../src/modules/todo/application/use-cases/reminder/create-reminder';
import { ReplaceTodoTags } from '../../src/modules/todo/application/use-cases/tag/replace-todo-tags';

const NOW = new Date('2026-11-07T10:00:00.000Z');

let client: DatabaseClient;
let authRepo: DrizzleAuthRepository;
let workspaceRepo: DrizzleWorkspaceRepository;
let todoRepo: DrizzleTodoRepository;
let tagRepo: DrizzleTagRepository;
let labelRepo: DrizzleLabelRepository;
let reminderRepo: DrizzleReminderRepository;
let unitOfWork: DrizzleTodoUnitOfWork;

beforeAll(() => {
  const config = loadAppConfig();
  client = createDatabaseClient(config.database, createLogger('silent'));
  authRepo = new DrizzleAuthRepository(client);
  workspaceRepo = new DrizzleWorkspaceRepository(client);
  todoRepo = new DrizzleTodoRepository(client.db);
  tagRepo = new DrizzleTagRepository(client.db);
  labelRepo = new DrizzleLabelRepository(client.db);
  reminderRepo = new DrizzleReminderRepository(client.db);
  unitOfWork = new DrizzleTodoUnitOfWork(client.db);
});

afterAll(async () => {
  await client.close();
});

async function createOwner(): Promise<{ userId: string; workspaceId: string }> {
  const user = await authRepo.createNewUser({
    email: toEmail(`meta_db_${crypto.randomUUID()}@example.com`),
    displayName: 'Metadata DB',
    passwordHash: 'hash',
    now: NOW
  });
  const { workspace } = await workspaceRepo.createWorkspaceWithMembership({
    name: `Meta ${crypto.randomUUID().slice(0, 8)}`,
    description: null,
    createdBy: user.id,
    now: NOW
  });

  return { userId: user.id, workspaceId: workspace.id };
}

async function seedTodo(
  workspaceId: string,
  userId: string,
  dueAt: Date | null = null
): Promise<Todo> {
  const todo = Todo.create({
    id: crypto.randomUUID(),
    workspaceId,
    createdBy: userId,
    title: `Todo ${crypto.randomUUID().slice(0, 8)}`,
    dueAt,
    now: NOW
  });

  return await todoRepo.create(todo);
}

function accessFor(repo: DrizzleWorkspaceRepository): TodoAccessService {
  return new TodoAccessService({
    findMembership: async (workspaceId, userId) => {
      const found = await repo.findWorkspaceWithRole(workspaceId, userId);

      if (!found) {
        return null;
      }

      return { role: found.role, workspaceArchivedAt: found.workspace.archivedAt };
    }
  });
}

function errorCode(error: unknown): string | null {
  return error instanceof TodoError ? error.code : null;
}

describe('Metadata schema terhadap PostgreSQL nyata', () => {
  test('index dan constraint metadata tersedia', async () => {
    const rows = await client.db.execute<{ indexname: string }>(sql`
      SELECT indexname
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND tablename IN ('tags', 'labels', 'todo_tags', 'reminders', 'todos')
    `);
    const names = rows.rows.map((row) => row.indexname);

    expect(names).toEqual(
      expect.arrayContaining([
        'tags_workspace_id_normalized_name_uidx',
        'tags_workspace_id_idx',
        'labels_workspace_id_normalized_name_uidx',
        'labels_workspace_id_idx',
        'todo_tags_pkey',
        'todo_tags_tag_id_todo_id_idx',
        'reminders_todo_id_idx',
        'reminders_todo_id_status_idx',
        'reminders_trigger_type_idx',
        'reminders_scheduled_absolute_remind_at_idx',
        'reminders_absolute_schedule_uidx',
        'reminders_before_due_schedule_uidx',
        'todos_workspace_label_id_created_at_id_idx'
      ])
    );
  });

  test('nama tag unik per workspace dan association tidak boleh duplikat', async () => {
    const { userId, workspaceId } = await createOwner();
    const other = await createOwner();
    const first = await tagRepo.create(
      Tag.create({
        id: crypto.randomUUID(),
        workspaceId,
        name: 'Backend',
        createdBy: userId,
        now: NOW
      })
    );

    await expect(
      tagRepo.create(
        Tag.create({
          id: crypto.randomUUID(),
          workspaceId,
          name: ' backend ',
          createdBy: userId,
          now: NOW
        })
      )
    ).rejects.toMatchObject({ code: 'TAG_ALREADY_EXISTS' });

    const elsewhere = await tagRepo.create(
      Tag.create({
        id: crypto.randomUUID(),
        workspaceId: other.workspaceId,
        name: 'Backend',
        createdBy: other.userId,
        now: NOW
      })
    );
    expect(elsewhere.workspaceId).toBe(other.workspaceId);

    const todo = await seedTodo(workspaceId, userId);
    await tagRepo.addTodoTag({ todoId: todo.id, tagId: first.id, now: NOW });

    await expect(
      Promise.resolve(
        client.db.insert(todoTags).values({
          todoId: todo.id,
          tagId: first.id,
          createdAt: NOW
        })
      )
    ).rejects.toThrow();
  });

  test('hapus tag menghapus association dan tidak menghapus todo', async () => {
    const { userId, workspaceId } = await createOwner();
    const tag = await tagRepo.create(
      Tag.create({
        id: crypto.randomUUID(),
        workspaceId,
        name: 'Docs',
        createdBy: userId,
        now: NOW
      })
    );
    const todo = await seedTodo(workspaceId, userId);
    await tagRepo.addTodoTag({ todoId: todo.id, tagId: tag.id, now: NOW });

    expect(await tagRepo.delete(workspaceId, tag.id)).toBe(true);

    const remaining = await todoRepo.findActiveById(workspaceId, todo.id);
    expect(remaining?.id).toBe(todo.id);
    expect(await tagRepo.findTodoTagIds(todo.id)).toEqual([]);
  });

  test('label unik, warna ditolak database, dan delete melakukan SET NULL', async () => {
    const { userId, workspaceId } = await createOwner();
    const label = await labelRepo.create(
      Label.create({
        id: crypto.randomUUID(),
        workspaceId,
        name: 'Personal',
        color: '#3498db',
        createdBy: userId,
        now: NOW
      })
    );
    expect(label.color).toBe('#3498DB');

    await expect(
      labelRepo.create(
        Label.create({
          id: crypto.randomUUID(),
          workspaceId,
          name: 'PERSONAL',
          color: '#111111',
          createdBy: userId,
          now: NOW
        })
      )
    ).rejects.toMatchObject({ code: 'LABEL_ALREADY_EXISTS' });

    await expect(
      Promise.resolve(
        client.db.insert(labels).values({
          id: crypto.randomUUID(),
          workspaceId,
          name: 'Invalid',
          normalizedName: `invalid-${crypto.randomUUID()}`,
          color: 'red',
          description: null,
          createdBy: userId,
          createdAt: NOW,
          updatedAt: NOW
        })
      )
    ).rejects.toThrow();

    const todo = await seedTodo(workspaceId, userId);
    const updated = await todoRepo.update(todo.update({ labelId: label.id }, NOW));
    expect(updated?.labelId).toBe(label.id);

    expect(await labelRepo.delete(workspaceId, label.id)).toBe(true);

    const after = await todoRepo.findActiveById(workspaceId, todo.id);
    expect(after).not.toBeNull();
    expect(after?.labelId).toBeNull();
    expect(after?.title).toBe(todo.title);
  });

  test('reminder menolak bentuk tidak valid dan jadwal scheduled duplikat', async () => {
    const { userId, workspaceId } = await createOwner();
    const todo = await seedTodo(workspaceId, userId, new Date('2026-11-10T09:00:00.000Z'));
    const remindAt = new Date('2026-11-09T01:00:00.000Z');

    await reminderRepo.create(
      Reminder.create({
        id: crypto.randomUUID(),
        todoId: todo.id,
        createdBy: userId,
        triggerType: ReminderTriggerType.ABSOLUTE,
        remindAt,
        now: NOW
      })
    );

    await expect(
      reminderRepo.create(
        Reminder.create({
          id: crypto.randomUUID(),
          todoId: todo.id,
          createdBy: userId,
          triggerType: ReminderTriggerType.ABSOLUTE,
          remindAt,
          now: NOW
        })
      )
    ).rejects.toMatchObject({ code: 'REMINDER_DUPLICATE' });

    await reminderRepo.create(
      Reminder.create({
        id: crypto.randomUUID(),
        todoId: todo.id,
        createdBy: userId,
        triggerType: ReminderTriggerType.BEFORE_DUE,
        offsetMinutes: 60,
        now: NOW
      })
    );

    await expect(
      reminderRepo.create(
        Reminder.create({
          id: crypto.randomUUID(),
          todoId: todo.id,
          createdBy: userId,
          triggerType: ReminderTriggerType.BEFORE_DUE,
          offsetMinutes: 60,
          now: NOW
        })
      )
    ).rejects.toMatchObject({ code: 'REMINDER_DUPLICATE' });

    await expect(
      Promise.resolve(
        client.db.execute(sql`
          INSERT INTO reminders (
            id, todo_id, created_by, trigger_type, remind_at, offset_minutes,
            status, created_at, updated_at, cancelled_at
          ) VALUES (
            ${crypto.randomUUID()}, ${todo.id}, ${userId}, 'absolute', NULL, 15,
            'scheduled', ${NOW}, ${NOW}, NULL
          )
        `)
      )
    ).rejects.toThrow();
  });

  test('assignment menolak tag dari workspace lain di dalam transaksi', async () => {
    const owner = await createOwner();
    const other = await createOwner();
    const todo = await seedTodo(owner.workspaceId, owner.userId);
    const foreign = await tagRepo.create(
      Tag.create({
        id: crypto.randomUUID(),
        workspaceId: other.workspaceId,
        name: 'Asing',
        createdBy: other.userId,
        now: NOW
      })
    );
    const replace = new ReplaceTodoTags(accessFor(workspaceRepo), unitOfWork, new FixedClock(NOW));

    await expect(
      replace.execute({
        workspaceId: owner.workspaceId,
        userId: owner.userId,
        todoId: todo.id,
        tagIds: [foreign.id]
      })
    ).rejects.toMatchObject({ code: 'TAG_WORKSPACE_MISMATCH' });

    const links = await client.db
      .select()
      .from(todoTags)
      .where(eq(todoTags.todoId, todo.id));
    expect(links).toHaveLength(0);
  });

  test('dua create tag konkuren hanya menyimpan satu nama', async () => {
    const { userId, workspaceId } = await createOwner();
    const name = `Race ${crypto.randomUUID().slice(0, 8)}`;
    const results = await Promise.allSettled([
      tagRepo.create(
        Tag.create({
          id: crypto.randomUUID(),
          workspaceId,
          name,
          createdBy: userId,
          now: NOW
        })
      ),
      tagRepo.create(
        Tag.create({
          id: crypto.randomUUID(),
          workspaceId,
          name: ` ${name.toUpperCase()} `,
          createdBy: userId,
          now: NOW
        })
      )
    ]);

    const succeeded = results.filter((result) => result.status === 'fulfilled');
    const failed = results.filter((result) => result.status === 'rejected');

    expect(succeeded).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect(errorCode(failed[0]?.status === 'rejected' ? failed[0].reason : null)).toBe(
      'TAG_ALREADY_EXISTS'
    );
  });

  test('dua reminder absolute konkuren pada waktu yang sama hanya satu yang lolos', async () => {
    const { userId, workspaceId } = await createOwner();
    const todo = await seedTodo(workspaceId, userId);
    const remindAt = new Date('2026-12-01T00:00:00.000Z');
    const results = await Promise.allSettled([
      reminderRepo.create(
        Reminder.create({
          id: crypto.randomUUID(),
          todoId: todo.id,
          createdBy: userId,
          triggerType: ReminderTriggerType.ABSOLUTE,
          remindAt,
          now: NOW
        })
      ),
      reminderRepo.create(
        Reminder.create({
          id: crypto.randomUUID(),
          todoId: todo.id,
          createdBy: userId,
          triggerType: ReminderTriggerType.ABSOLUTE,
          remindAt,
          now: NOW
        })
      )
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });

  test('pembuatan reminder menunggu lock baris todo sehingga melihat dueAt terbaru', async () => {
    const owner = await createOwner();
    const dueAt = new Date('2026-11-10T09:00:00.000Z');
    const todo = await seedTodo(owner.workspaceId, owner.userId, dueAt);
    const clock = new FixedClock(NOW);
    const createReminder = new CreateReminder(accessFor(workspaceRepo), unitOfWork, clock);

    let release: () => void = () => undefined;
    const locked = new Promise<void>((resolve) => {
      release = resolve;
    });

    const holder = client.db.transaction(async (tx) => {
      await tx.execute(sql`SELECT id FROM todos WHERE id = ${todo.id} FOR UPDATE`);
      release();
      await Bun.sleep(200);
      await tx
        .update(todos)
        .set({
          dueAt: new Date('2026-11-07T10:20:00.000Z'),
          updatedAt: new Date('2026-11-07T10:00:01.000Z')
        })
        .where(eq(todos.id, todo.id));
    });

    await locked;

    const created = createReminder.execute({
      workspaceId: owner.workspaceId,
      userId: owner.userId,
      todoId: todo.id,
      triggerType: ReminderTriggerType.BEFORE_DUE,
      offsetMinutes: 60
    });

    await holder;

    await expect(created).rejects.toMatchObject({ code: 'REMINDER_TIME_IN_PAST' });

    const stored = await client.db
      .select({ id: sql<string>`id` })
      .from(sql`reminders`)
      .where(sql`todo_id = ${todo.id}`);
    expect(stored).toHaveLength(0);
  });
});
