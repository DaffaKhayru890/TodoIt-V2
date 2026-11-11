import { describe, expect, test } from 'vitest';
import type { AppNotification } from '../models/notification.model';
import { flattenNotificationPages } from './flatten-notification-pages';
import { groupNotificationsByDate } from './notification-group';
import { getNotificationTypeConfig, getNotificationTypeLabel } from './notification-label';
import { getNotificationTarget, getNotificationTargetLabel } from './notification-navigation';
import { formatNotificationTime } from './notification-time';

const workspaceId = '11111111-1111-4111-8111-111111111111';
const todoId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function makeNotification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    type: 'todo_due_soon',
    title: 'Tenggat mendekat',
    body: 'Tugas segera jatuh tempo.',
    data: { workspaceId, todoId },
    readAt: null,
    createdAt: new Date('2026-11-11T09:00:00.000Z'),
    ...overrides
  };
}

describe('notification utilities', () => {
  test('label dan tone mengikuti jenis notifikasi yang didukung backend', () => {
    expect(getNotificationTypeLabel('reminder_due')).toBe('Pengingat');
    expect(getNotificationTypeLabel('todo_due_soon')).toBe('Tenggat mendekat');
    expect(getNotificationTypeConfig('reminder_due').tone).toBe('danger');
    expect(getNotificationTypeConfig('todo_due_soon').tone).toBe('warning');
  });

  test('target navigasi hanya dibuat untuk todoId dan workspaceId UUID', () => {
    expect(getNotificationTarget(makeNotification())).toBe(
      `/workspace/${workspaceId}/todos/${todoId}`
    );
    expect(getNotificationTarget(makeNotification({ data: {} }))).toBeNull();
    expect(
      getNotificationTarget(makeNotification({ data: { workspaceId, todoId: 'bukan-uuid' } }))
    ).toBeNull();
    expect(getNotificationTargetLabel(makeNotification())).toBe('Buka tugas terkait');
    expect(getNotificationTargetLabel(makeNotification({ data: {} }))).toBe(
      'Tugas terkait tidak tersedia'
    );
  });

  test('pengelompokan tanggal memakai hari lokal', () => {
    const now = new Date(2026, 10, 11, 12, 0, 0);
    const groups = groupNotificationsByDate(
      [
        makeNotification({ id: 'a', createdAt: new Date(2026, 10, 11, 8, 0, 0) }),
        makeNotification({ id: 'b', createdAt: new Date(2026, 10, 10, 8, 0, 0) }),
        makeNotification({ id: 'c', createdAt: new Date(2026, 10, 9, 8, 0, 0) })
      ],
      now
    );

    expect(groups.map((group) => [group.key, group.items.length])).toEqual([
      ['today', 1],
      ['yesterday', 1],
      ['earlier', 1]
    ]);
  });

  test('format waktu relatif deterministik', () => {
    const now = new Date('2026-11-11T12:00:00.000Z');

    expect(formatNotificationTime(new Date('2026-11-11T11:59:30.000Z'), now)).toBe('Baru saja');
    expect(formatNotificationTime(new Date('2026-11-11T11:30:00.000Z'), now)).toBe('30 menit lalu');
    expect(formatNotificationTime(new Date('2026-11-11T09:00:00.000Z'), now)).toBe('3 jam lalu');
    expect(formatNotificationTime(new Date('2026-11-10T09:00:00.000Z'), now)).toBe('Kemarin');
  });

  test('flatten membuang halaman kosong dan notifikasi duplikat', () => {
    const first = makeNotification({ id: 'a' });
    const second = makeNotification({ id: 'b' });

    expect(
      flattenNotificationPages([
        { items: [first, second], pagination: { limit: 20, hasMore: true, nextCursor: 'c1' } },
        { items: [second], pagination: { limit: 20, hasMore: false, nextCursor: null } }
      ])
    ).toEqual([first, second]);
    expect(flattenNotificationPages(undefined)).toEqual([]);
  });
});
