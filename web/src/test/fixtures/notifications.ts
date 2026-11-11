import type { NotificationDto } from '@/features/notifications/models/notification.dto';

/**
 * Fixture pengujian notifikasi. Bentuk mengikuti response backend setelah
 * serialisasi Date ke ISO string. Jangan diimpor dari kode produksi.
 */
export function makeNotificationDto(overrides: Partial<NotificationDto> = {}): NotificationDto {
  return {
    id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    type: 'todo_due_soon',
    title: 'Tenggat mendekat',
    body: 'Tugas contoh akan jatuh tempo dalam 30 menit.',
    data: {
      todoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      workspaceId: '11111111-1111-4111-8111-111111111111',
      dueAt: '2026-11-11T10:00:00.000Z'
    },
    readAt: null,
    createdAt: '2026-11-11T09:30:00.000Z',
    ...overrides
  };
}

export const notificationFixtures: readonly NotificationDto[] = [
  makeNotificationDto(),
  makeNotificationDto({
    id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    type: 'reminder_due',
    title: 'Pengingat tugas',
    body: 'Pengingat untuk tugas contoh.',
    readAt: '2026-11-11T08:00:00.000Z',
    createdAt: '2026-11-11T07:30:00.000Z'
  })
];
