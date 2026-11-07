import { createHash } from 'node:crypto';
import { TodoError } from '../../domain/errors/todo-error';
import type { ReminderCursorPosition } from '../../domain/repositories/reminder.repository';
import type {
  ReminderCursorCodec,
  ReminderCursorExpectation,
  ReminderCursorPayload,
  ReminderFilterFingerprintInput
} from '../../application/ports/reminder-cursor-codec';

const CURSOR_VERSION = 1;
const MAX_CURSOR_LENGTH = 2048;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DecodedCursorPayload {
  readonly version?: unknown;
  readonly todoId?: unknown;
  readonly effectiveAt?: unknown;
  readonly id?: unknown;
  readonly filterHash?: unknown;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();

  return `{${keys
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

/**
 * Cursor reminder memakai posisi (effectiveAt, id) karena ordering listing
 * adalah effectiveAt ASC, id ASC. effectiveAt boleh null untuk reminder
 * before_due yang Todo-nya sudah tidak memiliki dueAt (mis. reminder cancelled);
 * nilai null diurutkan terakhir.
 */
export class Base64UrlReminderCursorCodec implements ReminderCursorCodec {
  fingerprint(input: ReminderFilterFingerprintInput): string {
    return createHash('sha256').update(stableStringify(input), 'utf8').digest('hex');
  }

  encode(payload: ReminderCursorPayload): string {
    const json = JSON.stringify({
      version: CURSOR_VERSION,
      todoId: payload.todoId,
      effectiveAt: payload.effectiveAt ? payload.effectiveAt.toISOString() : null,
      id: payload.id,
      filterHash: payload.fingerprint
    });

    return Buffer.from(json, 'utf8').toString('base64url');
  }

  decode(cursor: string, expected: ReminderCursorExpectation): ReminderCursorPosition {
    if (
      cursor.length === 0 ||
      cursor.length > MAX_CURSOR_LENGTH ||
      !BASE64URL_PATTERN.test(cursor)
    ) {
      throw TodoError.invalidCursor();
    }

    const decoded = this.parse(cursor);

    if (decoded.version !== CURSOR_VERSION) {
      throw TodoError.invalidCursor();
    }

    if (decoded.todoId !== expected.todoId) {
      throw TodoError.invalidCursor();
    }

    if (decoded.filterHash !== expected.fingerprint) {
      throw TodoError.invalidCursor();
    }

    if (typeof decoded.id !== 'string' || !UUID_PATTERN.test(decoded.id)) {
      throw TodoError.invalidCursor();
    }

    if (decoded.effectiveAt === null) {
      return { effectiveAt: null, id: decoded.id };
    }

    if (typeof decoded.effectiveAt !== 'string') {
      throw TodoError.invalidCursor();
    }

    const effectiveAt = new Date(decoded.effectiveAt);

    if (
      Number.isNaN(effectiveAt.getTime()) ||
      effectiveAt.toISOString() !== decoded.effectiveAt
    ) {
      throw TodoError.invalidCursor();
    }

    return { effectiveAt, id: decoded.id };
  }

  private parse(cursor: string): DecodedCursorPayload {
    try {
      const json = Buffer.from(cursor, 'base64url').toString('utf8');
      const parsed: unknown = JSON.parse(json);

      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw TodoError.invalidCursor();
      }

      return parsed as DecodedCursorPayload;
    } catch (error) {
      if (error instanceof TodoError) {
        throw error;
      }

      throw TodoError.invalidCursor();
    }
  }
}
