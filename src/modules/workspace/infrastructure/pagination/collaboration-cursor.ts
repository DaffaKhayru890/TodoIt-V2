import { createHash } from 'node:crypto';
import { WorkspaceError } from '../../domain/errors/workspace-error';
import type {
  CollaborationCursorCodec,
  CollaborationFingerprintInput,
  InvitationCursorPayload,
  MemberCursorPayload
} from '../../application/ports/collaboration-cursor';

const VERSION = 1;
const MAX_LENGTH = 2048;
const BASE64URL = /^[A-Za-z0-9_-]+$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  const record = value as Record<string, unknown>;

  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function decodeJson(cursor: string): Record<string, unknown> {
  if (cursor.length === 0 || cursor.length > MAX_LENGTH || !BASE64URL.test(cursor)) {
    throw WorkspaceError.invalidCursor();
  }

  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as unknown;

    if (typeof parsed !== 'object' || parsed === null) {
      throw WorkspaceError.invalidCursor();
    }

    return parsed as Record<string, unknown>;
  } catch (error) {
    if (error instanceof WorkspaceError) {
      throw error;
    }

    throw WorkspaceError.invalidCursor();
  }
}

export class Base64UrlCollaborationCursorCodec implements CollaborationCursorCodec {
  fingerprint(input: CollaborationFingerprintInput): string {
    return createHash('sha256').update(stableStringify(input), 'utf8').digest('hex');
  }

  encodeInvitation(payload: InvitationCursorPayload): string {
    return Buffer.from(
      JSON.stringify({
        version: VERSION,
        kind: 'invitation',
        workspaceId: payload.workspaceId,
        createdAt: payload.createdAt.toISOString(),
        id: payload.id,
        filterHash: payload.fingerprint
      }),
      'utf8'
    ).toString('base64url');
  }

  decodeInvitation(cursor: string, expected: { workspaceId: string | null; fingerprint: string }) {
    const decoded = decodeJson(cursor);

    if (decoded.version !== VERSION || decoded.kind !== 'invitation') {
      throw WorkspaceError.invalidCursor();
    }

    if (decoded.workspaceId !== expected.workspaceId || decoded.filterHash !== expected.fingerprint) {
      throw WorkspaceError.invalidCursor();
    }

    if (typeof decoded.createdAt !== 'string' || typeof decoded.id !== 'string' || !UUID.test(decoded.id)) {
      throw WorkspaceError.invalidCursor();
    }

    const createdAt = new Date(decoded.createdAt);

    if (Number.isNaN(createdAt.getTime()) || createdAt.toISOString() !== decoded.createdAt) {
      throw WorkspaceError.invalidCursor();
    }

    return { createdAt, id: decoded.id };
  }

  encodeMember(payload: MemberCursorPayload): string {
    return Buffer.from(
      JSON.stringify({
        version: VERSION,
        kind: 'member',
        workspaceId: payload.workspaceId,
        joinedAt: payload.joinedAt.toISOString(),
        userId: payload.userId,
        filterHash: payload.fingerprint
      }),
      'utf8'
    ).toString('base64url');
  }

  decodeMember(cursor: string, expected: { workspaceId: string; fingerprint: string }) {
    const decoded = decodeJson(cursor);

    if (decoded.version !== VERSION || decoded.kind !== 'member') {
      throw WorkspaceError.invalidCursor();
    }

    if (decoded.workspaceId !== expected.workspaceId || decoded.filterHash !== expected.fingerprint) {
      throw WorkspaceError.invalidCursor();
    }

    if (typeof decoded.joinedAt !== 'string' || typeof decoded.userId !== 'string' || !UUID.test(decoded.userId)) {
      throw WorkspaceError.invalidCursor();
    }

    const joinedAt = new Date(decoded.joinedAt);

    if (Number.isNaN(joinedAt.getTime()) || joinedAt.toISOString() !== decoded.joinedAt) {
      throw WorkspaceError.invalidCursor();
    }

    return { joinedAt, userId: decoded.userId };
  }
}
