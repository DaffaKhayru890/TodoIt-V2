import { isValid, parseISO } from 'date-fns';
import { TodoError } from '../../domain/errors/todo-error';

/**
 * ISO 8601 dengan timezone eksplisit (Z atau ±HH:MM). Tanggal tanpa offset
 * sengaja ditolak supaya server tidak menebak timezone pengguna.
 */
export const EXPLICIT_ISO_INSTANT_PATTERN =
  /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,6})?)?(?:Z|[+-](?:0\d|1[0-4]):[0-5]\d)$/;

export type InstantParseErrorCode =
  | 'TODO_DUE_DATE_INVALID'
  | 'INVALID_DATE_RANGE'
  | 'REMINDER_TIME_INVALID';

/**
 * Parse timestamp API. Validasi dilakukan dua lapis: pola memastikan timezone
 * eksplisit dan rentang komponen wajar, parseISO memastikan tanggal kalender
 * benar-benar ada (mis. 30 Februari ditolak).
 */
export function parseExplicitInstant(value: string, errorCode: InstantParseErrorCode): Date {
  if (!EXPLICIT_ISO_INSTANT_PATTERN.test(value)) {
    if (errorCode === 'REMINDER_TIME_INVALID') {
      throw TodoError.reminderTimeInvalid(
        'Waktu reminder harus ISO 8601 dengan timezone eksplisit.'
      );
    }

    throw errorCode === 'TODO_DUE_DATE_INVALID'
      ? TodoError.invalidDueDate()
      : TodoError.invalidDateRange('Format tanggal filter harus ISO 8601 dengan timezone eksplisit.');
  }

  const parsed = parseISO(value);

  if (!isValid(parsed)) {
    if (errorCode === 'REMINDER_TIME_INVALID') {
      throw TodoError.reminderTimeInvalid('Waktu reminder tidak valid.');
    }

    throw errorCode === 'TODO_DUE_DATE_INVALID'
      ? TodoError.invalidDueDate('Tanggal jatuh tempo tidak valid.')
      : TodoError.invalidDateRange('Tanggal filter tidak valid.');
  }

  return parsed;
}

export function assertChronologicalRange(
  from: Date | undefined,
  to: Date | undefined,
  label: string
): void {
  if (from !== undefined && to !== undefined && from.getTime() > to.getTime()) {
    throw TodoError.invalidDateRange(`${label} tidak boleh lebih besar dari batas akhir.`);
  }
}
