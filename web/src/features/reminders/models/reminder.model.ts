export const REMINDER_TRIGGER_TYPES = ['absolute', 'before_due'] as const;

export type ReminderTriggerType = (typeof REMINDER_TRIGGER_TYPES)[number];

export const REMINDER_STATUSES = ['scheduled', 'cancelled'] as const;

export type ReminderStatus = (typeof REMINDER_STATUSES)[number];

export interface Reminder {
  readonly id: string;
  readonly todoId: string;
  readonly triggerType: ReminderTriggerType;
  readonly remindAt: Date | null;
  readonly offsetMinutes: number | null;
  readonly effectiveAt: Date | null;
  readonly status: ReminderStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly cancelledAt: Date | null;
}

export interface ReminderPagination {
  readonly limit: number;
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
}

export interface ReminderListResult {
  readonly items: readonly Reminder[];
  readonly pagination: ReminderPagination;
}

export interface CreateReminderInput {
  readonly triggerType: ReminderTriggerType;
  readonly remindAt?: Date | null;
  readonly offsetMinutes?: number | null;
}

export interface UpdateReminderInput {
  readonly remindAt?: Date;
  readonly offsetMinutes?: number;
}

export interface ListRemindersParams {
  readonly status?: ReminderStatus | 'all';
  readonly limit?: number;
  readonly cursor?: string;
}

/** Preset offset menit yang diterima backend (1-43200). */
export const REMINDER_INTERVAL_PRESETS = [
  { value: 5, label: '5 menit sebelum' },
  { value: 15, label: '15 menit sebelum' },
  { value: 30, label: '30 menit sebelum' },
  { value: 60, label: '1 jam sebelum' },
  { value: 1440, label: '1 hari sebelum' }
] as const;

export function isReminderTriggerType(value: string): value is ReminderTriggerType {
  return (REMINDER_TRIGGER_TYPES as readonly string[]).includes(value);
}

export function isReminderStatus(value: string): value is ReminderStatus {
  return (REMINDER_STATUSES as readonly string[]).includes(value);
}

export function formatReminderOffset(offsetMinutes: number | null): string {
  if (offsetMinutes === null) {
    return 'Tanpa pengingat';
  }

  const preset = REMINDER_INTERVAL_PRESETS.find((item) => item.value === offsetMinutes);

  if (preset) {
    return preset.label;
  }

  return `${offsetMinutes} menit sebelum`;
}
