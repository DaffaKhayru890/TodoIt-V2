import { createHash } from 'node:crypto';
import { TodoError } from '../../domain/errors/todo-error';
import type { TodoCursorPosition } from '../../domain/repositories/todo.repository';
import type {
  TodoCursorCodec,
  TodoCursorExpectation,
  TodoCursorPayload,
  TodoFilterFingerprintInput
} from '../../application/ports/todo-cursor-codec';

const CURSOR_VERSION = 1;
const MAX_CURSOR_LENGTH = 2048;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface DecodedCursorPayload {
  readonly version?: unknown;
  readonly workspaceId?: unknown;
  readonly createdAt?: unknown;
  readonly id?: unknown;
  readonly filterHash?: unknown;
}

/**
 * Serialisasi JSON dengan urutan key deterministik. Dipakai untuk fingerprint
 * supaya filter yang sama selalu menghasilkan hash yang sama, terlepas dari
 * urutan properti pada object TypeScript.
 */
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

export class Base64UrlCursorCodec implements TodoCursorCodec {
  fingerprint(input: TodoFilterFingerprintInput): string {
    return createHash('sha256').update(stableStringify(input), 'utf8').digest('hex');
  }

  encode(payload: TodoCursorPayload): string {
    const json = JSON.stringify({
      version: CURSOR_VERSION,
      workspaceId: payload.workspaceId,
      createdAt: payload.createdAt.toISOString(),
      id: payload.id,
      filterHash: payload.fingerprint
    });

    return Buffer.from(json, 'utf8').toString('base64url');
  }

  decode(cursor: string, expected: TodoCursorExpectation): TodoCursorPosition {
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

    if (decoded.workspaceId !== expected.workspaceId) {
      throw TodoError.invalidCursor();
    }

    if (decoded.filterHash !== expected.fingerprint) {
      throw TodoError.invalidCursor();
    }

    if (typeof decoded.createdAt !== 'string' || typeof decoded.id !== 'string') {
      throw TodoError.invalidCursor();
    }

    const createdAt = new Date(decoded.createdAt);

    if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== decoded.createdAt) {
      throw TodoError.invalidCursor();
    }

    if (!UUID_PATTERN.test(decoded.id)) {
      throw TodoError.invalidCursor();
    }

    return { createdAt, id: decoded.id };
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
