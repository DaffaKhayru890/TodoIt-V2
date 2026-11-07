import type { TodoCursorPosition } from '../../domain/repositories/todo.repository';

/** Nilai primitif yang boleh masuk ke fingerprint filter (tanpa data sensitif). */
export type FingerprintValue = string | number | boolean | null | readonly string[];

export type TodoFilterFingerprintInput = Readonly<Record<string, FingerprintValue>>;

export interface TodoCursorPayload {
  readonly workspaceId: string;
  readonly createdAt: Date;
  readonly id: string;
  readonly fingerprint: string;
}

export interface TodoCursorExpectation {
  readonly workspaceId: string;
  readonly fingerprint: string;
}

/**
 * Port encoding cursor. Implementasi production memakai Base64 URL-safe dan
 * SHA-256 untuk fingerprint; application layer hanya tahu kontraknya.
 */
export interface TodoCursorCodec {
  /** Menghasilkan fingerprint deterministik dari filter yang sudah dinormalisasi. */
  fingerprint(input: TodoFilterFingerprintInput): string;

  encode(payload: TodoCursorPayload): string;

  /**
   * Validasi format, versi, workspace, timestamp, UUID, dan fingerprint.
   * Melempar TodoError INVALID_CURSOR bila salah satu tidak cocok.
   */
  decode(cursor: string, expected: TodoCursorExpectation): TodoCursorPosition;
}
