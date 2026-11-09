import { describe, expect, test } from 'vitest';
import { tagFormSchema } from './tag.schema';

describe('tagFormSchema', () => {
  test('menerima nama valid dan melakukan trim', () => {
    const result = tagFormSchema.safeParse({ name: '  Backend  ' });

    expect(result.success).toBe(true);
    expect(result.success && result.data.name).toBe('Backend');
  });

  test('menolak nama kosong', () => {
    expect(tagFormSchema.safeParse({ name: '   ' }).success).toBe(false);
  });

  test('menolak nama lebih dari 50 karakter', () => {
    expect(tagFormSchema.safeParse({ name: 'a'.repeat(50) }).success).toBe(true);
    expect(tagFormSchema.safeParse({ name: 'a'.repeat(51) }).success).toBe(false);
  });
});
