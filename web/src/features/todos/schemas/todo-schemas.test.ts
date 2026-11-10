import { describe, expect, test } from 'vitest';
import { createTodoSchema } from './create-todo.schema';
import { updateTodoSchema } from './update-todo.schema';

const BASE_VALUES = {
  title: 'Belajar',
  priority: 'low' as const,
  dueAt: '',
  tagIds: [],
  labelId: null,
  reminderOffset: null
};

describe('Todo form schemas', () => {
  test('create menerima title valid dan description opsional', () => {
    expect(createTodoSchema.safeParse({ ...BASE_VALUES, description: '' }).success).toBe(true);
    expect(createTodoSchema.safeParse({ ...BASE_VALUES, description: 'Catatan' }).success).toBe(
      true
    );
    expect(createTodoSchema.safeParse(BASE_VALUES).success).toBe(true);
  });

  test('create menolak title kosong dan title lebih dari 200 karakter', () => {
    const empty = createTodoSchema.safeParse({ ...BASE_VALUES, title: '   ' });
    expect(empty.success).toBe(false);

    const tooLong = createTodoSchema.safeParse({ ...BASE_VALUES, title: 'a'.repeat(201) });
    expect(tooLong.success).toBe(false);
  });

  test('description maksimal 5000 karakter', () => {
    expect(
      updateTodoSchema.safeParse({
        ...BASE_VALUES,
        title: 'Valid',
        description: 'a'.repeat(5000)
      }).success
    ).toBe(true);
    expect(
      updateTodoSchema.safeParse({
        ...BASE_VALUES,
        title: 'Valid',
        description: 'a'.repeat(5001)
      }).success
    ).toBe(false);
  });

  test('update menggunakan aturan field yang sama dengan create', () => {
    expect(
      updateTodoSchema.safeParse({ ...BASE_VALUES, title: 'Judul baru', description: null }).success
    ).toBe(false);
    expect(
      updateTodoSchema.safeParse({ ...BASE_VALUES, title: 'Judul baru', description: '' }).success
    ).toBe(true);
  });

  test('menolak prioritas di luar enum backend', () => {
    expect(createTodoSchema.safeParse({ ...BASE_VALUES, priority: 'critical' }).success).toBe(
      false
    );
    expect(createTodoSchema.safeParse({ ...BASE_VALUES, priority: 'urgent' }).success).toBe(true);
  });

  test('menolak format tenggat waktu yang tidak valid', () => {
    expect(createTodoSchema.safeParse({ ...BASE_VALUES, dueAt: '2026-13-99T99:99' }).success).toBe(
      false
    );
    expect(createTodoSchema.safeParse({ ...BASE_VALUES, dueAt: '2026-11-10T09:00' }).success).toBe(
      true
    );
  });

  test('pengingat memerlukan tenggat waktu', () => {
    expect(createTodoSchema.safeParse({ ...BASE_VALUES, reminderOffset: 15 }).success).toBe(false);
    expect(
      createTodoSchema.safeParse({
        ...BASE_VALUES,
        dueAt: '2026-11-10T09:00',
        reminderOffset: 15
      }).success
    ).toBe(true);
  });

  test('offset pengingat harus berada pada rentang backend 1-43200 menit', () => {
    const dueAt = '2026-11-10T09:00';

    expect(createTodoSchema.safeParse({ ...BASE_VALUES, dueAt, reminderOffset: 0 }).success).toBe(
      false
    );
    expect(
      createTodoSchema.safeParse({ ...BASE_VALUES, dueAt, reminderOffset: 43_201 }).success
    ).toBe(false);
    expect(
      createTodoSchema.safeParse({ ...BASE_VALUES, dueAt, reminderOffset: 43_200 }).success
    ).toBe(true);
  });
});
