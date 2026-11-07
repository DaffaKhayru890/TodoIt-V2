import type { Reminder } from '../entities/reminder';
import type { ReminderStatus } from '../enums/reminder-status';

/**
 * Posisi keyset reminder: pasangan (effectiveAt, id). effectiveAt dihitung
 * dinamis dari remindAt atau dueAt - offsetMinutes.
 */
export interface ReminderCursorPosition {
  readonly effectiveAt: Date | null;
  readonly id: string;
}

export interface ReminderListQuery {
  readonly todoId: string;
  /** Daftar status yang disertakan; undefined berarti semua status. */
  readonly statuses?: readonly ReminderStatus[];
  /** dueAt Todo dipakai untuk menghitung effectiveAt before_due. */
  readonly dueAt: Date | null;
  readonly cursor: ReminderCursorPosition | null;
  readonly limit: number;
}

export interface ReminderListResult {
  readonly items: readonly Reminder[];
  readonly hasMore: boolean;
}

export type CancelReminderOutcome = 'cancelled' | 'already_cancelled' | 'not_found';

/**
 * Kontrak repository Reminder. Repository tidak melakukan otorisasi workspace;
 * use case memastikan Todo berada pada workspace yang diakses lebih dahulu.
 */
export interface ReminderRepository {
  /** Melempar REMINDER_DUPLICATE bila jadwal scheduled yang sama sudah ada. */
  create(reminder: Reminder): Promise<Reminder>;

  findById(todoId: string, reminderId: string): Promise<Reminder | null>;

  /** Hanya memperbarui reminder scheduled; mengembalikan null bila tidak ada. */
  update(reminder: Reminder): Promise<Reminder | null>;

  list(query: ReminderListQuery): Promise<ReminderListResult>;

  /** Cancel idempoten; membedakan sudah-cancelled dari tidak ditemukan. */
  cancel(todoId: string, reminderId: string, now: Date): Promise<CancelReminderOutcome>;

  findScheduledByTodoId(todoId: string): Promise<readonly Reminder[]>;

  /** Dipakai lifecycle Todo untuk membatalkan seluruh reminder scheduled. */
  cancelScheduledByTodoId(todoId: string, now: Date): Promise<number>;
}
