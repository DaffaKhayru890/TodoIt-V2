import type { ReminderCursorPosition } from '../../domain/repositories/reminder.repository';
import type { FingerprintValue } from './todo-cursor-codec';

export type ReminderFilterFingerprintInput = Readonly<Record<string, FingerprintValue>>;

export interface ReminderCursorPayload {
  readonly todoId: string;
  readonly effectiveAt: Date | null;
  readonly id: string;
  readonly fingerprint: string;
}

export interface ReminderCursorExpectation {
  readonly todoId: string;
  readonly fingerprint: string;
}

/**
 * Port cursor khusus listing Reminder. Ordering memakai effectiveAt (bukan
 * createdAt), sehingga codec Todo tidak dapat dipakai ulang tanpa kehilangan
 * makna posisi.
 */
export interface ReminderCursorCodec {
  fingerprint(input: ReminderFilterFingerprintInput): string;

  encode(payload: ReminderCursorPayload): string;

  decode(cursor: string, expected: ReminderCursorExpectation): ReminderCursorPosition;
}
