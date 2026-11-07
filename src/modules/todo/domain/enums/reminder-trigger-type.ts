/**
 * Jenis pemicu reminder.
 *
 * ABSOLUTE memakai `remindAt` sebagai waktu absolut, sedangkan BEFORE_DUE
 * dihitung dinamis dari `dueAt` Todo dikurangi `offsetMinutes`.
 */
export const ReminderTriggerType = {
  ABSOLUTE: 'absolute',
  BEFORE_DUE: 'before_due'
} as const;

export type ReminderTriggerType =
  (typeof ReminderTriggerType)[keyof typeof ReminderTriggerType];

export const REMINDER_TRIGGER_TYPES: readonly ReminderTriggerType[] = [
  ReminderTriggerType.ABSOLUTE,
  ReminderTriggerType.BEFORE_DUE
];

export function isReminderTriggerType(value: string): value is ReminderTriggerType {
  return (REMINDER_TRIGGER_TYPES as readonly string[]).includes(value);
}
