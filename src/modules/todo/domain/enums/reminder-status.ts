/**
 * Status reminder pada Phase 4.
 *
 * Status pengiriman notifikasi (mis. sent/delivered) sengaja tidak ada di sini;
 * itu merupakan tanggung jawab Notification Engine pada Phase 6.
 */
export const ReminderStatus = {
  SCHEDULED: 'scheduled',
  CANCELLED: 'cancelled'
} as const;

export type ReminderStatus = (typeof ReminderStatus)[keyof typeof ReminderStatus];

export const REMINDER_STATUSES: readonly ReminderStatus[] = [
  ReminderStatus.SCHEDULED,
  ReminderStatus.CANCELLED
];

export function isReminderStatus(value: string): value is ReminderStatus {
  return (REMINDER_STATUSES as readonly string[]).includes(value);
}
