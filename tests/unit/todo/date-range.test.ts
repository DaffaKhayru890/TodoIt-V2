import { describe, expect, test } from 'bun:test';
import { FixedClock } from '../../../src/shared/domain/clock';
import { TodoDateRangeService } from '../../../src/modules/todo/application/services/todo-date-range.service';
import { ApplicationError } from '../../../src/shared/domain/errors/application-error';

function serviceAt(instant: string, defaultTimezone = 'UTC'): TodoDateRangeService {
  return new TodoDateRangeService(new FixedClock(new Date(instant)), defaultTimezone);
}

function errorCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ApplicationError) {
      return error.code;
    }

    throw error;
  }

  throw new Error('Fungsi seharusnya melempar error');
}

describe('TodoDateRangeService — Today', () => {
  test('UTC: interval [awal hari, awal hari berikutnya)', () => {
    const range = serviceAt('2026-11-07T10:00:00.000Z').today('UTC');

    expect(range.start.toISOString()).toBe('2026-11-07T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-11-08T00:00:00.000Z');
  });

  test('Asia/Jakarta: hari kalender mengikuti UTC+7', () => {
    const range = serviceAt('2026-11-07T10:00:00.000Z').today('Asia/Jakarta');

    expect(range.timezone).toBe('Asia/Jakarta');
    expect(range.start.toISOString()).toBe('2026-11-06T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-11-07T17:00:00.000Z');
  });

  test('Asia/Tokyo: tengah malam lokal adalah 15:00Z hari sebelumnya', () => {
    const range = serviceAt('2026-11-07T10:00:00.000Z').today('Asia/Tokyo');

    expect(range.start.toISOString()).toBe('2026-11-06T15:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-11-07T15:00:00.000Z');
  });

  test('America/New_York pada pergantian DST berlangsung 23 jam', () => {
    // 8 Maret 2026: DST dimulai pukul 02:00 waktu lokal.
    const range = serviceAt('2026-03-08T12:00:00.000Z').today('America/New_York');
    const durationHours = (range.end.getTime() - range.start.getTime()) / 3_600_000;

    expect(range.start.toISOString()).toBe('2026-03-08T05:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(durationHours).toBe(23);
  });

  test('timezone kosong memakai default dari konfigurasi', () => {
    const range = serviceAt('2026-11-07T10:00:00.000Z', 'Asia/Jakarta').today(undefined);

    expect(range.timezone).toBe('Asia/Jakarta');
    expect(range.start.toISOString()).toBe('2026-11-06T17:00:00.000Z');
  });

  test('timezone invalid ditolak dengan INVALID_TIMEZONE', () => {
    expect(errorCode(() => serviceAt('2026-11-07T10:00:00.000Z').today('Asia/Jakarta+7'))).toBe(
      'INVALID_TIMEZONE'
    );
    expect(errorCode(() => serviceAt('2026-11-07T10:00:00.000Z').today('Not/AZone'))).toBe(
      'INVALID_TIMEZONE'
    );
  });
});

describe('TodoDateRangeService — Upcoming', () => {
  test('default 7 hari dimulai besok dan berakhir pada awal hari ke-8', () => {
    const range = serviceAt('2026-11-07T10:00:00.000Z').upcoming('UTC');

    expect(range.start.toISOString()).toBe('2026-11-08T00:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-11-15T00:00:00.000Z');
  });

  test('custom days menghitung hari kalender pada timezone pengguna', () => {
    const range = serviceAt('2026-11-07T10:00:00.000Z').upcoming('Asia/Jakarta', 3);

    expect(range.start.toISOString()).toBe('2026-11-07T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-11-10T17:00:00.000Z');
  });

  test('DST: rentang upcoming tetap mengikuti hari kalender lokal', () => {
    const range = serviceAt('2026-03-08T12:00:00.000Z').upcoming('America/New_York', 2);

    expect(range.start.toISOString()).toBe('2026-03-09T04:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-03-11T04:00:00.000Z');
  });

  test('days harus 1..30', () => {
    const service = serviceAt('2026-11-07T10:00:00.000Z');

    expect(service.upcoming('UTC', 1).start.toISOString()).toBe('2026-11-08T00:00:00.000Z');
    expect(service.upcoming('UTC', 30).start.toISOString()).toBe('2026-11-08T00:00:00.000Z');
    expect(errorCode(() => service.upcoming('UTC', 0))).toBe('INVALID_UPCOMING_RANGE');
    expect(errorCode(() => service.upcoming('UTC', 31))).toBe('INVALID_UPCOMING_RANGE');
    expect(errorCode(() => service.upcoming('UTC', 1.5))).toBe('INVALID_UPCOMING_RANGE');
  });
});

describe('TodoDateRangeService — Overdue', () => {
  test('overdue memakai awal hari ini menurut timezone', () => {
    const range = serviceAt('2026-11-07T10:00:00.000Z').overdue('Asia/Jakarta');

    expect(range.start.toISOString()).toBe('2026-11-06T17:00:00.000Z');
    expect(range.end.toISOString()).toBe('2026-11-07T17:00:00.000Z');
  });
});
