import { describe, expect, test } from 'bun:test';
import { Label } from '../../../src/modules/todo/domain/entities/label';
import { Tag } from '../../../src/modules/todo/domain/entities/tag';
import {
  Reminder,
  REMINDER_OFFSET_MAX_MINUTES,
  computeReminderEffectiveAt
} from '../../../src/modules/todo/domain/entities/reminder';
import { Todo } from '../../../src/modules/todo/domain/entities/todo';
import { ReminderStatus } from '../../../src/modules/todo/domain/enums/reminder-status';
import { ReminderTriggerType } from '../../../src/modules/todo/domain/enums/reminder-trigger-type';
import { TodoPriority } from '../../../src/modules/todo/domain/enums/todo-priority';
import { TodoError } from '../../../src/modules/todo/domain/errors/todo-error';
import { normalizeLabelColor } from '../../../src/modules/todo/domain/value-objects/label-color';
import { normalizeMetadataName } from '../../../src/modules/todo/domain/value-objects/metadata-name';

const NOW = new Date('2026-11-07T10:00:00.000Z');
const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';

function errorCode(action: () => unknown): string | null {
  try {
    action();
    return null;
  } catch (error) {
    return error instanceof TodoError ? error.code : 'UNKNOWN';
  }
}

const nameErrors = {
  required: () => TodoError.tagNameRequired(),
  tooLong: (maxLength: number) => TodoError.tagNameTooLong(maxLength),
  invalid: (message: string) => TodoError.tagNameInvalid(message)
};

describe('Metadata value objects', () => {
  test('normalisasi nama hanya trim dan lowercase tanpa transliterasi', () => {
    expect(normalizeMetadataName('  Pekerjaan Rumah  ', nameErrors)).toEqual({
      name: 'Pekerjaan Rumah',
      normalizedName: 'pekerjaan rumah'
    });

    expect(normalizeMetadataName('Café', nameErrors).normalizedName).toBe('café');
  });

  test('menolak nama kosong, terlalu panjang, dan karakter kontrol', () => {
    expect(errorCode(() => normalizeMetadataName('   ', nameErrors))).toBe('TAG_NAME_REQUIRED');
    expect(errorCode(() => normalizeMetadataName('a'.repeat(51), nameErrors))).toBe(
      'TAG_NAME_TOO_LONG'
    );
    expect(errorCode(() => normalizeMetadataName('baris\nbaru', nameErrors))).toBe(
      'TAG_NAME_INVALID'
    );
    expect(errorCode(() => normalizeMetadataName(42, nameErrors))).toBe('TAG_NAME_INVALID');
  });

  test('warna label hanya menerima #RRGGBB dan disimpan uppercase', () => {
    expect(normalizeLabelColor('#aabbcc')).toBe('#AABBCC');
    expect(normalizeLabelColor('  #123456 ')).toBe('#123456');

    for (const invalid of ['#FFF', '123456', '#GGGGGG', '#1234567', '']) {
      expect(errorCode(() => normalizeLabelColor(invalid))).toBe('LABEL_COLOR_INVALID');
    }
  });
});

describe('Tag entity', () => {
  test('create menormalkan nama dan mempertahankan tampilan asli', () => {
    const tag = Tag.create({
      id: crypto.randomUUID(),
      workspaceId: WORKSPACE_ID,
      name: '  Backend  ',
      createdBy: USER_ID,
      now: NOW
    });

    expect(tag.name).toBe('Backend');
    expect(tag.normalizedName).toBe('backend');
    expect(tag.workspaceId).toBe(WORKSPACE_ID);
    expect(tag.createdBy).toBe(USER_ID);
  });

  test('Backend, backend, dan BACKEND menghasilkan normalizedName yang sama', () => {
    const names = ['Backend', 'backend', ' BACKEND '].map(
      (name) =>
        Tag.create({
          id: crypto.randomUUID(),
          workspaceId: WORKSPACE_ID,
          name,
          createdBy: USER_ID,
          now: NOW
        }).normalizedName
    );

    expect(new Set(names).size).toBe(1);
    expect(names[0]).toBe('backend');
  });

  test('nama kosong, spasi, dan terlalu panjang ditolak', () => {
    const create = (name: string) =>
      Tag.create({
        id: crypto.randomUUID(),
        workspaceId: WORKSPACE_ID,
        name,
        createdBy: USER_ID,
        now: NOW
      });

    expect(errorCode(() => create(''))).toBe('TAG_NAME_REQUIRED');
    expect(errorCode(() => create('   '))).toBe('TAG_NAME_REQUIRED');
    expect(errorCode(() => create('a'.repeat(51)))).toBe('TAG_NAME_TOO_LONG');
  });
});

describe('Label entity', () => {
  test('create menormalkan nama, warna, dan deskripsi', () => {
    const label = Label.create({
      id: crypto.randomUUID(),
      workspaceId: WORKSPACE_ID,
      name: '  Pekerjaan  ',
      color: '#a1b2c3',
      description: '  Urusan kantor  ',
      createdBy: USER_ID,
      now: NOW
    });

    expect(label.name).toBe('Pekerjaan');
    expect(label.normalizedName).toBe('pekerjaan');
    expect(label.color).toBe('#A1B2C3');
    expect(label.description).toBe('Urusan kantor');
  });

  test('deskripsi kosong menjadi null dan deskripsi terlalu panjang ditolak', () => {
    const create = (description: string | null) =>
      Label.create({
        id: crypto.randomUUID(),
        workspaceId: WORKSPACE_ID,
        name: 'Label',
        color: '#000000',
        description,
        createdBy: USER_ID,
        now: NOW
      });

    expect(create('   ').description).toBeNull();
    expect(errorCode(() => create('a'.repeat(301)))).toBe('LABEL_DESCRIPTION_TOO_LONG');
  });

  test('update mengganti field yang diberikan dan mempertahankan sisanya', () => {
    const label = Label.create({
      id: crypto.randomUUID(),
      workspaceId: WORKSPACE_ID,
      name: 'Lama',
      color: '#000000',
      description: 'Deskripsi',
      createdBy: USER_ID,
      now: NOW
    });

    const updated = label.update(
      { name: 'Baru', color: '#FFFFFF' },
      new Date('2026-11-07T11:00:00.000Z')
    );

    expect(updated.name).toBe('Baru');
    expect(updated.color).toBe('#FFFFFF');
    expect(updated.description).toBe('Deskripsi');
    expect(updated.updatedAt.toISOString()).toBe('2026-11-07T11:00:00.000Z');

    const cleared = updated.update({ description: null }, NOW);
    expect(cleared.description).toBeNull();
  });

  test('restore menolak normalizedName yang tidak konsisten', () => {
    expect(
      errorCode(() =>
        Label.restore({
          id: crypto.randomUUID(),
          workspaceId: WORKSPACE_ID,
          name: 'Pekerjaan',
          normalizedName: 'lain',
          color: '#000000',
          description: null,
          createdBy: USER_ID,
          createdAt: NOW,
          updatedAt: NOW
        })
      )
    ).toBe('LABEL_NAME_INVALID');
  });
});

describe('Reminder entity', () => {
  const absoluteProps = {
    id: crypto.randomUUID(),
    todoId: crypto.randomUUID(),
    createdBy: USER_ID,
    triggerType: ReminderTriggerType.ABSOLUTE,
    remindAt: new Date('2026-11-08T10:00:00.000Z'),
    now: NOW
  } as const;

  test('absolute menghitung effectiveAt dari remindAt', () => {
    const reminder = Reminder.create(absoluteProps);

    expect(reminder.status).toBe(ReminderStatus.SCHEDULED);
    expect(reminder.cancelledAt).toBeNull();
    expect(reminder.effectiveAt(null)?.toISOString()).toBe('2026-11-08T10:00:00.000Z');
  });

  test('before_due menghitung effectiveAt dinamis dari dueAt dan offset', () => {
    const reminder = Reminder.create({
      id: crypto.randomUUID(),
      todoId: crypto.randomUUID(),
      createdBy: USER_ID,
      triggerType: ReminderTriggerType.BEFORE_DUE,
      offsetMinutes: 60,
      now: NOW
    });

    const dueAt = new Date('2026-11-08T10:00:00.000Z');
    expect(reminder.effectiveAt(dueAt)?.toISOString()).toBe('2026-11-08T09:00:00.000Z');
    expect(reminder.effectiveAt(null)).toBeNull();
    expect(
      reminder.effectiveAt(new Date('2026-11-09T10:00:00.000Z'))?.toISOString()
    ).toBe('2026-11-09T09:00:00.000Z');
  });

  test('offset di luar 1 sampai 43200 ditolak', () => {
    const create = (offsetMinutes: number) =>
      Reminder.create({
        id: crypto.randomUUID(),
        todoId: crypto.randomUUID(),
        createdBy: USER_ID,
        triggerType: ReminderTriggerType.BEFORE_DUE,
        offsetMinutes,
        now: NOW
      });

    expect(errorCode(() => create(0))).toBe('REMINDER_OFFSET_INVALID');
    expect(errorCode(() => create(1.5))).toBe('REMINDER_OFFSET_INVALID');
    expect(errorCode(() => create(REMINDER_OFFSET_MAX_MINUTES + 1))).toBe(
      'REMINDER_OFFSET_INVALID'
    );
    expect(errorCode(() => create(REMINDER_OFFSET_MAX_MINUTES))).toBeNull();
  });

  test('bentuk trigger tidak konsisten ditolak', () => {
    expect(
      errorCode(() =>
        Reminder.create({
          ...absoluteProps,
          offsetMinutes: 30
        })
      )
    ).toBe('REMINDER_TIME_INVALID');

    expect(
      errorCode(() =>
        Reminder.create({
          id: crypto.randomUUID(),
          todoId: crypto.randomUUID(),
          createdBy: USER_ID,
          triggerType: ReminderTriggerType.ABSOLUTE,
          now: NOW
        })
      )
    ).toBe('REMINDER_TIME_INVALID');

    expect(
      errorCode(() =>
        Reminder.create({
          id: crypto.randomUUID(),
          todoId: crypto.randomUUID(),
          createdBy: USER_ID,
          triggerType: ReminderTriggerType.BEFORE_DUE,
          remindAt: new Date('2026-11-08T10:00:00.000Z'),
          offsetMinutes: 30,
          now: NOW
        })
      )
    ).toBe('REMINDER_TIME_INVALID');
  });

  test('cancel idempoten tidak menggeser cancelledAt', () => {
    const reminder = Reminder.create(absoluteProps);
    const cancelled = reminder.cancel(new Date('2026-11-07T11:00:00.000Z'));

    expect(cancelled.status).toBe(ReminderStatus.CANCELLED);
    expect(cancelled.cancelledAt?.toISOString()).toBe('2026-11-07T11:00:00.000Z');

    const repeated = cancelled.cancel(new Date('2026-11-07T12:00:00.000Z'));
    expect(repeated).toBe(cancelled);
  });

  test('reminder cancelled tidak dapat dijadwalkan ulang', () => {
    const cancelled = Reminder.create(absoluteProps).cancel(NOW);

    expect(
      errorCode(() =>
        cancelled.updateSchedule(
          { remindAt: new Date('2026-11-09T10:00:00.000Z') },
          NOW
        )
      )
    ).toBe('REMINDER_ALREADY_CANCELLED');
  });

  test('updateSchedule menolak perubahan lintas trigger', () => {
    const absolute = Reminder.create(absoluteProps);

    expect(errorCode(() => absolute.updateSchedule({ offsetMinutes: 30 }, NOW))).toBe(
      'REMINDER_TIME_INVALID'
    );

    const relative = Reminder.create({
      id: crypto.randomUUID(),
      todoId: crypto.randomUUID(),
      createdBy: USER_ID,
      triggerType: ReminderTriggerType.BEFORE_DUE,
      offsetMinutes: 30,
      now: NOW
    });

    expect(
      errorCode(() =>
        relative.updateSchedule(
          { remindAt: new Date('2026-11-09T10:00:00.000Z') },
          NOW
        )
      )
    ).toBe('REMINDER_TIME_INVALID');
  });
});

describe('computeReminderEffectiveAt', () => {
  test('mengembalikan null untuk before_due tanpa dueAt', () => {
    expect(
      computeReminderEffectiveAt(ReminderTriggerType.BEFORE_DUE, null, 30, null)
    ).toBeNull();
  });

  test('mengembalikan null untuk absolute tanpa remindAt', () => {
    expect(
      computeReminderEffectiveAt(
        ReminderTriggerType.ABSOLUTE,
        null,
        null,
        new Date('2026-11-08T10:00:00.000Z')
      )
    ).toBeNull();
  });
});

describe('Todo labelId', () => {
  test('labelId default null, dapat diubah oleh update, dan masuk snapshot', () => {
    const todo = Todo.create({
      id: crypto.randomUUID(),
      workspaceId: WORKSPACE_ID,
      title: 'Todo',
      createdBy: USER_ID,
      now: NOW
    });

    expect(todo.labelId).toBeNull();

    const labelId = crypto.randomUUID();
    const updated = todo.update({ labelId }, new Date('2026-11-07T11:00:00.000Z'));

    expect(updated.labelId).toBe(labelId);
    expect(updated.toSnapshot().labelId).toBe(labelId);
    expect(updated.update({ labelId: null }, NOW).labelId).toBeNull();
  });

  test('restore tanpa labelId tetap kompatibel (null)', () => {
    const restored = Todo.restore({
      id: crypto.randomUUID(),
      workspaceId: WORKSPACE_ID,
      title: 'Todo',
      description: null,
      status: 'todo',
      priority: TodoPriority.LOW,
      dueAt: null,
      completedAt: null,
      createdBy: USER_ID,
      createdAt: NOW,
      updatedAt: NOW,
      deletedAt: null
    });

    expect(restored.labelId).toBeNull();
  });
});
