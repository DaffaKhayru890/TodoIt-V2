import { describe, expect, test } from 'vitest';
import { createTodoSchema } from './create-todo.schema';
import { updateTodoSchema } from './update-todo.schema';

describe('Todo form schemas', () => {
  test('create menerima title valid dan description opsional', () => {
    expect(createTodoSchema.safeParse({ title: 'Belajar', description: '' }).success).toBe(true);
    expect(createTodoSchema.safeParse({ title: 'Belajar', description: 'Catatan' }).success).toBe(
      true
    );
    expect(createTodoSchema.safeParse({ title: 'Belajar' }).success).toBe(true);
  });

  test('create menolak title kosong dan title lebih dari 200 karakter', () => {
    const empty = createTodoSchema.safeParse({ title: '   ' });
    expect(empty.success).toBe(false);

    const tooLong = createTodoSchema.safeParse({ title: 'a'.repeat(201) });
    expect(tooLong.success).toBe(false);
  });

  test('description maksimal 5000 karakter', () => {
    expect(
      updateTodoSchema.safeParse({ title: 'Valid', description: 'a'.repeat(5000) }).success
    ).toBe(true);
    expect(
      updateTodoSchema.safeParse({ title: 'Valid', description: 'a'.repeat(5001) }).success
    ).toBe(false);
  });

  test('update menggunakan aturan field yang sama dengan create', () => {
    expect(updateTodoSchema.safeParse({ title: 'Judul baru', description: null }).success).toBe(
      false
    );
    expect(updateTodoSchema.safeParse({ title: 'Judul baru', description: '' }).success).toBe(true);
  });
});
