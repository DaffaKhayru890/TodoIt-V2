import { describe, expect, test } from 'vitest';
import { readAppEnv } from '@/core/config/env';

describe('readAppEnv', () => {
  test('menerima URL API yang valid', () => {
    expect(readAppEnv({ VITE_API_BASE_URL: 'http://localhost:4000/' })).toEqual({
      apiBaseUrl: 'http://localhost:4000'
    });
  });

  test('menolak konfigurasi yang kosong', () => {
    expect(() => readAppEnv({})).toThrow(/wajib diisi/);
  });
});
