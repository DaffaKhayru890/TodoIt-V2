import { describe, expect, test } from 'vitest';
import type { TodoPriority } from './todo.model';
import { PRIORITY_CONFIG, getPriorityConfig, getPriorityLabel, getPriorityWeight } from './todo-priority';

describe('todo-priority', () => {
  test('menyediakan konfigurasi lengkap untuk seluruh enum backend', () => {
    expect(PRIORITY_CONFIG.map((item) => item.value)).toEqual([
      'low',
      'medium',
      'high',
      'urgent'
    ]);
    expect(new Set(PRIORITY_CONFIG.map((item) => item.cssModifier)).size).toBe(4);
  });

  test('bobot sorting naik dari low ke urgent', () => {
    expect(getPriorityWeight('low')).toBe(1);
    expect(getPriorityWeight('medium')).toBe(2);
    expect(getPriorityWeight('high')).toBe(3);
    expect(getPriorityWeight('urgent')).toBe(4);
  });

  test('label sesuai bahasa Indonesia', () => {
    expect(getPriorityLabel('low')).toBe('Rendah');
    expect(getPriorityLabel('medium')).toBe('Sedang');
    expect(getPriorityLabel('high')).toBe('Tinggi');
    expect(getPriorityLabel('urgent')).toBe('Mendesak');
  });

  test('getPriorityConfig mengembalikan konfigurasi yang cocok', () => {
    expect(getPriorityConfig('high')).toMatchObject({
      value: 'high',
      label: 'Tinggi',
      sortWeight: 3
    });
  });

  test('nilai tak dikenal jatuh ke konfigurasi low tanpa melempar error', () => {
    expect(getPriorityConfig('unknown' as TodoPriority).value).toBe('low');
  });
});
