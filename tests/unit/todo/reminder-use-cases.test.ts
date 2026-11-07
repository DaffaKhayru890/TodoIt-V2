import { describe, expect, test } from 'bun:test';
import { ReminderStatus } from '../../../src/modules/todo/domain/enums/reminder-status';
import { ReminderTriggerType } from '../../../src/modules/todo/domain/enums/reminder-trigger-type';
import { TodoError } from '../../../src/modules/todo/domain/errors/todo-error';
import { WorkspaceRole } from '../../../src/modules/workspace/domain/enums/workspace-role';
import { createTodoFixture, type TodoFixture } from '../../helpers/todo-fixtures';

const DUE_AT = new Date('2026-11-08T10:00:00.000Z');
const FUTURE = new Date('2026-11-08T09:00:00.000Z');

async function setup(): Promise<TodoFixture> {
  return await createTodoFixture();
}

async function captureError(action: () => Promise<unknown>): Promise<string | null> {
  try {
    await action();
    return null;
  } catch (error) {
    return error instanceof TodoError ? error.code : null;
  }
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

describe('Create reminder', () => {
  test('absolute valid dan effectiveAt sama dengan remindAt', async () => {
    const fixture = await setup();
    const todo = await fixture.seed();

    const reminder = await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      triggerType: ReminderTriggerType.ABSOLUTE,
      remindAt: FUTURE
    });

    expect(reminder.status).toBe(ReminderStatus.SCHEDULED);
    expect(reminder.remindAt?.toISOString()).toBe(FUTURE.toISOString());
    expect(reminder.offsetMinutes).toBeNull();
    expect(reminder.effectiveAt?.toISOString()).toBe(FUTURE.toISOString());
    expect(reminder.cancelledAt).toBeNull();
  });

  test('absolute di masa lalu ditolak', async () => {
    const fixture = await setup();
    const todo = await fixture.seed();

    expect(
      await captureError(() =>
        fixture.createReminder.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          triggerType: ReminderTriggerType.ABSOLUTE,
          remindAt: new Date('2026-11-07T09:59:00.000Z')
        })
      )
    ).toBe('REMINDER_TIME_IN_PAST');
  });

  test('before_due membutuhkan dueAt dan waktu efektif future', async () => {
    const fixture = await setup();
    const withoutDue = await fixture.seed();

    expect(
      await captureError(() =>
        fixture.createReminder.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: withoutDue.id,
          triggerType: ReminderTriggerType.BEFORE_DUE,
          offsetMinutes: 60
        })
      )
    ).toBe('REMINDER_DUE_DATE_REQUIRED');

    const todo = await fixture.seed({ dueAt: DUE_AT });

    const reminder = await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      triggerType: ReminderTriggerType.BEFORE_DUE,
      offsetMinutes: 60
    });

    expect(reminder.effectiveAt?.toISOString()).toBe('2026-11-08T09:00:00.000Z');

    expect(
      await captureError(() =>
        fixture.createReminder.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          triggerType: ReminderTriggerType.BEFORE_DUE,
          offsetMinutes: 43_200
        })
      )
    ).toBe('REMINDER_TIME_IN_PAST');
  });

  test('offset tidak valid ditolak dan triggerType tidak dikenal ditolak', async () => {
    const fixture = await setup();
    const todo = await fixture.seed({ dueAt: DUE_AT });

    for (const offsetMinutes of [0, -1, 43_201, 1.5]) {
      expect(
        await captureError(() =>
          fixture.createReminder.execute({
            workspaceId: fixture.workspaceId,
            userId: fixture.userId,
            todoId: todo.id,
            triggerType: ReminderTriggerType.BEFORE_DUE,
            offsetMinutes
          })
        )
      ).toBe('REMINDER_OFFSET_INVALID');
    }

    expect(
      await captureError(() =>
        fixture.createReminder.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          triggerType: 'later'
        })
      )
    ).toBe('REMINDER_TRIGGER_TYPE_INVALID');
  });

  test('kombinasi field yang salah ditolak', async () => {
    const fixture = await setup();
    const todo = await fixture.seed({ dueAt: DUE_AT });

    expect(
      await captureError(() =>
        fixture.createReminder.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          triggerType: ReminderTriggerType.ABSOLUTE,
          remindAt: FUTURE,
          offsetMinutes: 30
        })
      )
    ).toBe('REMINDER_TIME_INVALID');

    expect(
      await captureError(() =>
        fixture.createReminder.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          triggerType: ReminderTriggerType.BEFORE_DUE,
          remindAt: FUTURE,
          offsetMinutes: 30
        })
      )
    ).toBe('REMINDER_TIME_INVALID');
  });

  test('jadwal scheduled duplikat ditolak', async () => {
    const fixture = await setup();
    const todo = await fixture.seed({ dueAt: DUE_AT });

    await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      triggerType: ReminderTriggerType.ABSOLUTE,
      remindAt: FUTURE
    });

    expect(
      await captureError(() =>
        fixture.createReminder.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          triggerType: ReminderTriggerType.ABSOLUTE,
          remindAt: new Date(FUTURE.getTime())
        })
      )
    ).toBe('REMINDER_DUPLICATE');

    await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      triggerType: ReminderTriggerType.BEFORE_DUE,
      offsetMinutes: 60
    });

    expect(
      await captureError(() =>
        fixture.createReminder.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          triggerType: ReminderTriggerType.BEFORE_DUE,
          offsetMinutes: 60
        })
      )
    ).toBe('REMINDER_DUPLICATE');
  });

  test('todo completed/cancelled tidak dapat diberi reminder', async () => {
    const fixture = await setup();
    const todo = await fixture.seed();

    await fixture.completeTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    expect(
      await captureError(() =>
        fixture.createReminder.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          triggerType: ReminderTriggerType.ABSOLUTE,
          remindAt: FUTURE
        })
      )
    ).toBe('REMINDER_TODO_INELIGIBLE');
  });

  test('member boleh membuat reminder', async () => {
    const fixture = await setup();
    const member = addMember(fixture);
    const todo = await fixture.seed();

    const reminder = await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: member,
      todoId: todo.id,
      triggerType: ReminderTriggerType.ABSOLUTE,
      remindAt: FUTURE
    });

    expect(reminder.id).toBeString();
  });
});

describe('List, get, update, cancel reminder', () => {
  test('listing mengurutkan effectiveAt ASC dengan tie-breaker id', async () => {
    const fixture = await setup();
    const todo = await fixture.seed({ dueAt: DUE_AT });

    // dueAt 10:00Z dikurangi 30 menit = 09:30Z, sama dengan absolute di bawah.
    const absolute = await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      triggerType: ReminderTriggerType.ABSOLUTE,
      remindAt: new Date('2026-11-08T09:30:00.000Z')
    });
    const relative = await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      triggerType: ReminderTriggerType.BEFORE_DUE,
      offsetMinutes: 30
    });
    const later = await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      triggerType: ReminderTriggerType.ABSOLUTE,
      remindAt: new Date('2026-11-08T11:00:00.000Z')
    });

    const list = await fixture.listTodoReminders.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });

    const tied = [absolute, relative].sort((left, right) => left.id.localeCompare(right.id));
    const firstTied = tied[0];
    const secondTied = tied[1];

    if (!firstTied || !secondTied) {
      throw new Error('Dua reminder dengan effectiveAt sama harus ada.');
    }

    expect(list.items.map((reminder) => reminder.id)).toEqual([
      firstTied.id,
      secondTied.id,
      later.id
    ]);
    expect(list.items[0]?.effectiveAt?.toISOString()).toBe('2026-11-08T09:30:00.000Z');
    expect(list.items[1]?.effectiveAt?.toISOString()).toBe('2026-11-08T09:30:00.000Z');
    expect(list.items[2]?.effectiveAt?.toISOString()).toBe('2026-11-08T11:00:00.000Z');
    expect(list.pagination.hasMore).toBe(false);
  });

  test('listing default scheduled dan status=all menyertakan cancelled', async () => {
    const fixture = await setup();
    const todo = await fixture.seed();
    const reminder = await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      triggerType: ReminderTriggerType.ABSOLUTE,
      remindAt: FUTURE
    });

    await fixture.cancelReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      reminderId: reminder.id
    });

    const scheduled = await fixture.listTodoReminders.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id
    });
    expect(scheduled.items).toHaveLength(0);

    const all = await fixture.listTodoReminders.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      status: 'all'
    });
    expect(all.items).toHaveLength(1);
    expect(all.items[0]?.status).toBe(ReminderStatus.CANCELLED);

    expect(
      await captureError(() =>
        fixture.listTodoReminders.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          status: 'sent'
        })
      )
    ).toBe('VALIDATION_ERROR');
  });

  test('get dan cross-todo isolation', async () => {
    const fixture = await setup();
    const first = await fixture.seed();
    const second = await fixture.seed();
    const reminder = await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: first.id,
      triggerType: ReminderTriggerType.ABSOLUTE,
      remindAt: FUTURE
    });

    const found = await fixture.getReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: first.id,
      reminderId: reminder.id
    });
    expect(found.id).toBe(reminder.id);

    expect(
      await captureError(() =>
        fixture.getReminder.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: second.id,
          reminderId: reminder.id
        })
      )
    ).toBe('REMINDER_NOT_FOUND');

    expect(
      await captureError(() =>
        fixture.getReminder.execute({
          workspaceId: fixture.otherWorkspaceId,
          userId: fixture.otherUserId,
          todoId: first.id,
          reminderId: reminder.id
        })
      )
    ).toBe('TODO_NOT_FOUND');
  });

  test('update absolute ke masa lalu ditolak dan update valid berhasil', async () => {
    const fixture = await setup();
    const todo = await fixture.seed();
    const reminder = await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      triggerType: ReminderTriggerType.ABSOLUTE,
      remindAt: FUTURE
    });

    expect(
      await captureError(() =>
        fixture.updateReminder.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          reminderId: reminder.id,
          remindAt: new Date('2026-11-07T09:00:00.000Z')
        })
      )
    ).toBe('REMINDER_TIME_IN_PAST');

    const updated = await fixture.updateReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      reminderId: reminder.id,
      remindAt: new Date('2026-11-09T10:00:00.000Z')
    });

    expect(updated.remindAt?.toISOString()).toBe('2026-11-09T10:00:00.000Z');
  });

  test('update before_due yang membuat efektif lampau ditolak', async () => {
    const fixture = await setup();
    const todo = await fixture.seed({ dueAt: DUE_AT });
    const reminder = await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      triggerType: ReminderTriggerType.BEFORE_DUE,
      offsetMinutes: 30
    });

    expect(
      await captureError(() =>
        fixture.updateReminder.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          reminderId: reminder.id,
          offsetMinutes: 43_200
        })
      )
    ).toBe('REMINDER_TIME_IN_PAST');
  });

  test('reminder cancelled tidak dapat diubah dan cancel idempoten', async () => {
    const fixture = await setup();
    const todo = await fixture.seed();
    const reminder = await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      triggerType: ReminderTriggerType.ABSOLUTE,
      remindAt: FUTURE
    });

    await fixture.cancelReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      reminderId: reminder.id
    });
    await fixture.cancelReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      reminderId: reminder.id
    });

    expect(
      await captureError(() =>
        fixture.updateReminder.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          reminderId: reminder.id,
          remindAt: new Date('2026-11-10T10:00:00.000Z')
        })
      )
    ).toBe('REMINDER_ALREADY_CANCELLED');
  });
});

describe('Reminder lifecycle mengikuti status Todo', () => {
  async function seedWithReminder(
    fixture: TodoFixture,
    dueAt: Date | null = DUE_AT
  ): Promise<{ todoId: string; reminderId: string }> {
    const todo = await fixture.seed({ dueAt });

    const reminder = await fixture.createReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      triggerType:
        dueAt === null ? ReminderTriggerType.ABSOLUTE : ReminderTriggerType.BEFORE_DUE,
      ...(dueAt === null
        ? { remindAt: FUTURE }
        : { offsetMinutes: 60 })
    });

    return { todoId: todo.id, reminderId: reminder.id };
  }

  test('complete membatalkan reminder scheduled secara atomik', async () => {
    const fixture = await setup();
    const { todoId, reminderId } = await seedWithReminder(fixture);

    await fixture.completeTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId
    });

    const stored = await fixture.reminderRepo.findById(todoId, reminderId);
    expect(stored?.status).toBe(ReminderStatus.CANCELLED);
    expect(stored?.cancelledAt?.toISOString()).toBe(fixture.clock.now().toISOString());

    // Reopen tidak mengaktifkan kembali reminder.
    await fixture.updateTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId,
      status: 'todo'
    });

    const reopened = await fixture.reminderRepo.findById(todoId, reminderId);
    expect(reopened?.status).toBe(ReminderStatus.CANCELLED);
  });

  test('update status cancelled membatalkan reminder', async () => {
    const fixture = await setup();
    const { todoId, reminderId } = await seedWithReminder(fixture);

    await fixture.updateTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId,
      status: 'cancelled'
    });

    expect((await fixture.reminderRepo.findById(todoId, reminderId))?.status).toBe(
      ReminderStatus.CANCELLED
    );
  });

  test('delete todo membatalkan reminder', async () => {
    const fixture = await setup();
    const { todoId, reminderId } = await seedWithReminder(fixture);

    await fixture.deleteTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId
    });

    expect((await fixture.reminderRepo.findById(todoId, reminderId))?.status).toBe(
      ReminderStatus.CANCELLED
    );
  });

  test('dueAt null ditolak selama reminder before_due scheduled', async () => {
    const fixture = await setup();
    const { todoId } = await seedWithReminder(fixture);

    expect(
      await captureError(() =>
        fixture.updateTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId,
          dueAt: null
        })
      )
    ).toBe('TODO_HAS_RELATIVE_REMINDERS');

    const stored = fixture.todoRepo.todos.find((todo) => todo.id === todoId);
    expect(stored?.dueAt?.toISOString()).toBe(DUE_AT.toISOString());
  });

  test('perubahan dueAt yang membuat efektif lampau ditolak', async () => {
    const fixture = await setup();
    const { todoId } = await seedWithReminder(fixture);

    expect(
      await captureError(() =>
        fixture.updateTodo.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId,
          dueAt: new Date('2026-11-07T10:30:00.000Z')
        })
      )
    ).toBe('TODO_DUE_DATE_CONFLICTS_WITH_REMINDERS');

    // dueAt yang tetap valid diterima.
    const updated = await fixture.updateTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId,
      dueAt: new Date('2026-11-09T10:00:00.000Z')
    });

    expect(updated.dueAt?.toISOString()).toBe('2026-11-09T10:00:00.000Z');
  });

  test('dueAt boleh dikosongkan bila reminder before_due sudah cancelled', async () => {
    const fixture = await setup();
    const { todoId, reminderId } = await seedWithReminder(fixture);

    await fixture.cancelReminder.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId,
      reminderId
    });

    const updated = await fixture.updateTodo.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId,
      dueAt: null
    });

    expect(updated.dueAt).toBeNull();
  });
});

describe('Reminder cursor', () => {
  test('pagination effectiveAt konsisten dan filter status terikat cursor', async () => {
    const fixture = await setup();
    const todo = await fixture.seed({ dueAt: DUE_AT });

    for (const offsetMinutes of [10, 20, 30]) {
      await fixture.createReminder.execute({
        workspaceId: fixture.workspaceId,
        userId: fixture.userId,
        todoId: todo.id,
        triggerType: ReminderTriggerType.BEFORE_DUE,
        offsetMinutes
      });
    }

    const page = await fixture.listTodoReminders.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      limit: 2
    });

    expect(page.items).toHaveLength(2);
    expect(page.pagination.nextCursor).not.toBeNull();

    const next = await fixture.listTodoReminders.execute({
      workspaceId: fixture.workspaceId,
      userId: fixture.userId,
      todoId: todo.id,
      limit: 2,
      cursor: page.pagination.nextCursor
    });

    expect(next.items).toHaveLength(1);

    expect(
      await captureError(() =>
        fixture.listTodoReminders.execute({
          workspaceId: fixture.workspaceId,
          userId: fixture.userId,
          todoId: todo.id,
          limit: 2,
          cursor: page.pagination.nextCursor,
          status: 'all'
        })
      )
    ).toBe('INVALID_CURSOR');
  });
});
