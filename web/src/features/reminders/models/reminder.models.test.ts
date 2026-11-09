import { describe, expect, test } from 'vitest';
import { ApiError } from '@/core/errors/api-error';
import { makeReminderDto, reminderFixtures } from '@/test/fixtures/reminders';
import { assertReminderListResponseDto, assertReminderResponseDto } from './reminder.guard';
import {
  formatReminderOffset,
  isReminderStatus,
  isReminderTriggerType,
  REMINDER_INTERVAL_PRESETS
} from './reminder.model';
import {
  toCreateReminderRequestDto,
  toReminder,
  toReminderListResult,
  toUpdateReminderRequestDto
} from './reminder.mapper';

describe('reminder.guard', () => {
  test('menerima response reminder dan daftar yang valid', () => {
    expect(() => assertReminderResponseDto({ reminder: makeReminderDto() })).not.toThrow();
    expect(() =>
      assertReminderListResponseDto({
        items: reminderFixtures,
        pagination: { limit: 100, hasMore: false, nextCursor: null }
      })
    ).not.toThrow();
  });

  test('menolak bentuk reminder yang rusak', () => {
    expect(() => assertReminderResponseDto({ reminder: { id: 'rusak' } })).toThrow(ApiError);
    expect(() =>
      assertReminderResponseDto({
        reminder: { ...makeReminderDto(), offsetMinutes: 1.5 }
      })
    ).toThrow(ApiError);
    expect(() =>
      assertReminderListResponseDto({
        items: [],
        pagination: { limit: 100, hasMore: false, nextCursor: 10 }
      })
    ).toThrow(ApiError);
  });

  test('kode error konsisten INVALID_REMINDER_RESPONSE', () => {
    try {
      assertReminderResponseDto({ reminder: {} });
      expect.unreachable('Seharusnya melempar error');
    } catch (error) {
      expect(error).toMatchObject({ code: 'INVALID_REMINDER_RESPONSE' });
    }
  });
});

describe('reminder.mapper', () => {
  test('toReminder memetakan tanggal dan nullable fields', () => {
    const reminder = toReminder(makeReminderDto());

    expect(reminder.triggerType).toBe('before_due');
    expect(reminder.offsetMinutes).toBe(15);
    expect(reminder.remindAt).toBeNull();
    expect(reminder.effectiveAt).toBeInstanceOf(Date);
    expect(reminder.cancelledAt).toBeNull();
    expect(reminder.createdAt).toBeInstanceOf(Date);
  });

  test('toReminder menerima reminder absolute', () => {
    const reminder = toReminder(
      makeReminderDto({
        triggerType: 'absolute',
        remindAt: '2026-11-12T09:00:00.000Z',
        offsetMinutes: null
      })
    );

    expect(reminder.triggerType).toBe('absolute');
    expect(reminder.remindAt).toBeInstanceOf(Date);
    expect(reminder.offsetMinutes).toBeNull();
  });

  test('toReminder menolak enum atau tanggal yang tidak valid', () => {
    expect(() => toReminder(makeReminderDto({ triggerType: 'unknown' }))).toThrow(ApiError);
    expect(() => toReminder(makeReminderDto({ status: 'sent' }))).toThrow(ApiError);
    expect(() => toReminder(makeReminderDto({ createdAt: 'rusak' }))).toThrow(ApiError);
  });

  test('toReminderListResult mempertahankan pagination', () => {
    const result = toReminderListResult({
      items: reminderFixtures,
      pagination: { limit: 100, hasMore: true, nextCursor: 'cursor-1' }
    });

    expect(result.items).toHaveLength(1);
    expect(result.pagination.nextCursor).toBe('cursor-1');
  });

  test('toCreateReminderRequestDto menyerialkan Date ke ISO dan mempertahankan null', () => {
    expect(
      toCreateReminderRequestDto({
        triggerType: 'absolute',
        remindAt: new Date('2026-11-12T09:00:00.000Z')
      })
    ).toEqual({
      triggerType: 'absolute',
      remindAt: '2026-11-12T09:00:00.000Z'
    });

    expect(
      toCreateReminderRequestDto({ triggerType: 'before_due', offsetMinutes: 15 })
    ).toEqual({ triggerType: 'before_due', offsetMinutes: 15 });

    expect(
      toCreateReminderRequestDto({ triggerType: 'absolute', remindAt: null })
    ).toEqual({ triggerType: 'absolute', remindAt: null });
  });

  test('toUpdateReminderRequestDto hanya mengirim field yang diberikan', () => {
    expect(toUpdateReminderRequestDto({})).toEqual({});
    expect(toUpdateReminderRequestDto({ offsetMinutes: 30 })).toEqual({ offsetMinutes: 30 });
    expect(
      toUpdateReminderRequestDto({ remindAt: new Date('2026-11-12T09:00:00.000Z') })
    ).toEqual({ remindAt: '2026-11-12T09:00:00.000Z' });
  });
});

describe('reminder model helpers', () => {
  test('mengenali trigger type dan status yang valid', () => {
    expect(isReminderTriggerType('absolute')).toBe(true);
    expect(isReminderTriggerType('before_due')).toBe(true);
    expect(isReminderTriggerType('after_due')).toBe(false);
    expect(isReminderStatus('scheduled')).toBe(true);
    expect(isReminderStatus('cancelled')).toBe(true);
    expect(isReminderStatus('sent')).toBe(false);
  });

  test('formatReminderOffset memakai preset dan fallback', () => {
    expect(formatReminderOffset(null)).toBe('Tanpa pengingat');
    expect(formatReminderOffset(5)).toBe('5 menit sebelum');
    expect(formatReminderOffset(1440)).toBe('1 hari sebelum');
    expect(formatReminderOffset(90)).toBe('90 menit sebelum');
  });

  test('preset hanya berisi offset yang diterima backend', () => {
    for (const preset of REMINDER_INTERVAL_PRESETS) {
      expect(preset.value).toBeGreaterThanOrEqual(1);
      expect(preset.value).toBeLessThanOrEqual(43_200);
    }
  });
});
