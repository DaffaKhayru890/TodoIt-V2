import { describe, expect, test } from 'vitest';
import {
  formatDate,
  formatDateTime,
  formatGroupDate,
  formatLongDate,
  parseDateInputValue,
  parseDateTimeInputValue,
  toDateInputValue,
  toDateTimeInputValue
} from './date-format';

describe('date-format', () => {
  test('memformat tanggal dengan locale id-ID', () => {
    const date = new Date(2026, 10, 9, 14, 5);

    expect(formatDate(date)).toMatch(/9.*Nov.*2026/);
    expect(formatLongDate(date)).toMatch(/Senin.*9.*November.*2026/);
    expect(formatDateTime(date)).toMatch(/9.*Nov.*2026.*14\.05/);
    expect(formatGroupDate(date)).toMatch(/Senin.*9.*November/);
  });

  test('toDateInputValue mem-pad bulan dan hari', () => {
    expect(toDateInputValue(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  test('toDateTimeInputValue mem-pad jam dan menit', () => {
    expect(toDateTimeInputValue(new Date(2026, 0, 5, 4, 7))).toBe('2026-01-05T04:07');
  });

  test('parseDateTimeInputValue membaca waktu lokal', () => {
    const parsed = parseDateTimeInputValue('2026-11-10T09:30');

    expect(parsed).not.toBeNull();
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(10);
    expect(parsed?.getDate()).toBe(10);
    expect(parsed?.getHours()).toBe(9);
    expect(parsed?.getMinutes()).toBe(30);
    expect(parseDateTimeInputValue(toDateTimeInputValue(parsed!))).toEqual(parsed);
  });

  test('parseDateTimeInputValue menolak nilai kosong atau format salah', () => {
    expect(parseDateTimeInputValue('')).toBeNull();
    expect(parseDateTimeInputValue('2026-11-10')).toBeNull();
    expect(parseDateTimeInputValue('10/11/2026 09:30')).toBeNull();
    expect(parseDateTimeInputValue('2026-11-10T09:30:00')).toBeNull();
  });

  test('parseDateTimeInputValue menolak tanggal kalender yang tidak ada', () => {
    expect(parseDateTimeInputValue('2026-02-31T09:00')).toBeNull();
    expect(parseDateTimeInputValue('2026-13-01T09:00')).toBeNull();
    expect(parseDateTimeInputValue('2026-11-10T25:00')).toBeNull();
  });

  test('parseDateInputValue membaca awal hari lokal', () => {
    const parsed = parseDateInputValue('2026-11-10');

    expect(parsed).not.toBeNull();
    expect(parsed?.getHours()).toBe(0);
    expect(parsed?.getMinutes()).toBe(0);
    expect(parsed?.getSeconds()).toBe(0);
    expect(parsed?.getMilliseconds()).toBe(0);
  });

  test('parseDateInputValue menolak nilai kosong, format salah, dan tanggal tidak ada', () => {
    expect(parseDateInputValue('')).toBeNull();
    expect(parseDateInputValue('2026-11')).toBeNull();
    expect(parseDateInputValue('2026-02-30')).toBeNull();
    expect(parseDateInputValue('2026-12-01')).not.toBeNull();
  });
});
