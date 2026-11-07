import { describe, expect, test } from 'bun:test';
import { Base64UrlCursorCodec } from '../../../src/modules/todo/infrastructure/pagination/cursor-encoder';
import { ApplicationError } from '../../../src/shared/domain/errors/application-error';

const WORKSPACE_ID = '11111111-1111-4111-8111-111111111111';
const TODO_ID = '33333333-3333-4333-8333-333333333333';
const CREATED_AT = new Date('2026-11-07T10:00:00.000Z');

function errorCode(run: () => unknown): string {
  try {
    run();
  } catch (error) {
    if (error instanceof ApplicationError) {
      return error.code;
    }

    throw error;
  }

  throw new Error('Fungsi seharusnya melempar error');
}

function encodeRaw(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

describe('Base64UrlCursorCodec', () => {
  test('encode/decode roundtrip menghasilkan posisi yang sama', () => {
    const codec = new Base64UrlCursorCodec();
    const fingerprint = codec.fingerprint({ status: 'todo', search: null });
    const cursor = codec.encode({
      workspaceId: WORKSPACE_ID,
      createdAt: CREATED_AT,
      id: TODO_ID,
      fingerprint
    });
    const decoded = codec.decode(cursor, { workspaceId: WORKSPACE_ID, fingerprint });

    expect(decoded.createdAt.toISOString()).toBe(CREATED_AT.toISOString());
    expect(decoded.id).toBe(TODO_ID);
    expect(cursor).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  test('fingerprint deterministik tanpa memedulikan urutan key', () => {
    const codec = new Base64UrlCursorCodec();

    const first = codec.fingerprint({ status: 'todo', priority: 'high' });
    const second = codec.fingerprint({ priority: 'high', status: 'todo' });

    expect(first).toBe(second);
  });

  test('fingerprint berbeda untuk filter berbeda', () => {
    const codec = new Base64UrlCursorCodec();

    expect(codec.fingerprint({ status: 'todo' })).not.toBe(codec.fingerprint({ status: 'completed' }));
  });

  test('menolak cursor dari workspace lain', () => {
    const codec = new Base64UrlCursorCodec();
    const fingerprint = codec.fingerprint({ kind: 'list' });
    const cursor = codec.encode({
      workspaceId: WORKSPACE_ID,
      createdAt: CREATED_AT,
      id: TODO_ID,
      fingerprint
    });

    expect(
      errorCode(() =>
        codec.decode(cursor, {
          workspaceId: '99999999-9999-4999-8999-999999999999',
          fingerprint
        })
      )
    ).toBe('INVALID_CURSOR');
  });

  test('menolak cursor dari filter berbeda', () => {
    const codec = new Base64UrlCursorCodec();
    const cursor = codec.encode({
      workspaceId: WORKSPACE_ID,
      createdAt: CREATED_AT,
      id: TODO_ID,
      fingerprint: codec.fingerprint({ status: 'todo' })
    });

    expect(
      errorCode(() =>
        codec.decode(cursor, { workspaceId: WORKSPACE_ID, fingerprint: codec.fingerprint({ status: 'high' }) })
      )
    ).toBe('INVALID_CURSOR');
  });

  test('menolak format Base64 yang tidak valid', () => {
    const codec = new Base64UrlCursorCodec();
    const fingerprint = codec.fingerprint({ kind: 'list' });

    expect(errorCode(() => codec.decode('%%%bukan-cursor%%%', { workspaceId: WORKSPACE_ID, fingerprint }))).toBe(
      'INVALID_CURSOR'
    );
  });

  test('menolak JSON yang bukan object', () => {
    const codec = new Base64UrlCursorCodec();
    const fingerprint = codec.fingerprint({ kind: 'list' });
    const cursor = Buffer.from(JSON.stringify([1, 2, 3]), 'utf8').toString('base64url');

    expect(errorCode(() => codec.decode(cursor, { workspaceId: WORKSPACE_ID, fingerprint }))).toBe(
      'INVALID_CURSOR'
    );
  });

  test('menolak version yang tidak dikenal', () => {
    const codec = new Base64UrlCursorCodec();
    const fingerprint = codec.fingerprint({ kind: 'list' });
    const cursor = encodeRaw({
      version: 2,
      workspaceId: WORKSPACE_ID,
      createdAt: CREATED_AT.toISOString(),
      id: TODO_ID,
      filterHash: fingerprint
    });

    expect(errorCode(() => codec.decode(cursor, { workspaceId: WORKSPACE_ID, fingerprint }))).toBe(
      'INVALID_CURSOR'
    );
  });

  test('menolak timestamp yang tidak konsisten dan UUID rusak', () => {
    const codec = new Base64UrlCursorCodec();
    const fingerprint = codec.fingerprint({ kind: 'list' });

    const badTimestamp = encodeRaw({
      version: 1,
      workspaceId: WORKSPACE_ID,
      createdAt: '2026-02-30T00:00:00.000Z',
      id: TODO_ID,
      filterHash: fingerprint
    });

    expect(errorCode(() => codec.decode(badTimestamp, { workspaceId: WORKSPACE_ID, fingerprint }))).toBe(
      'INVALID_CURSOR'
    );

    const badUuid = encodeRaw({
      version: 1,
      workspaceId: WORKSPACE_ID,
      createdAt: CREATED_AT.toISOString(),
      id: 'bukan-uuid',
      filterHash: fingerprint
    });

    expect(errorCode(() => codec.decode(badUuid, { workspaceId: WORKSPACE_ID, fingerprint }))).toBe(
      'INVALID_CURSOR'
    );
  });
});
