import type { ReminderDto } from '@/features/reminders/models/reminder.dto';

export function makeReminderDto(overrides: Partial<ReminderDto> = {}): ReminderDto {
  return {
    id: 'c1111111-1111-4111-8111-111111111111',
    todoId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    triggerType: 'before_due',
    remindAt: null,
    offsetMinutes: 15,
    effectiveAt: '2026-11-12T08:45:00.000Z',
    status: 'scheduled',
    createdAt: '2026-11-01T00:00:00.000Z',
    updatedAt: '2026-11-01T00:00:00.000Z',
    cancelledAt: null,
    ...overrides
  };
}

export const reminderFixtures: readonly ReminderDto[] = [makeReminderDto()];
