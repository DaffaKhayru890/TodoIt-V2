import { describe, expect, test } from 'bun:test';
import { ERROR_CODES } from '../../src/shared/presentation/http/errors/error-response';
import { buildTestApp, connectedProbe, failingProbe, getRequest, hangingProbe } from '../helpers/test-app';

/** Potongan informasi internal yang tidak boleh keluar ke klien. */
const INTERNAL_DETAILS = ['10.0.0.1', 'ECONNREFUSED', 'db.internal.test', 'svc_todo', 'rahasia-test', 'todo_test', '5432'];

describe('GET /ready', () => {
  test('mengembalikan HTTP 200 saat database tersedia', async () => {
    const { app } = buildTestApp({ probe: connectedProbe });

    const response = await app.handle(getRequest('/ready'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      status: 'ready',
      dependencies: { database: 'connected' }
    });
  });

  test('mengembalikan HTTP 503 dengan sampul error saat database tidak tersedia', async () => {
    const { app } = buildTestApp({ probe: failingProbe });

    const response = await app.handle(getRequest('/ready'));
    const body = (await response.json()) as Record<string, Record<string, string>>;

    expect(response.status).toBe(503);
    expect(body.error?.code).toBe(ERROR_CODES.SERVICE_UNAVAILABLE);
    expect(body.error?.message).toBeString();
    expect(body.error?.requestId).toBeString();
  });

  test('mengembalikan HTTP 503 saat pemeriksaan melebihi batas waktu', async () => {
    const { app } = buildTestApp({ probe: hangingProbe, readinessTimeoutMs: 20 });

    const response = await app.handle(getRequest('/ready'));

    expect(response.status).toBe(503);
  });

  test('tidak mengekspose detail internal database saat tidak siap', async () => {
    const { app } = buildTestApp({ probe: failingProbe });

    const response = await app.handle(getRequest('/ready'));
    const text = await response.text();

    for (const detail of INTERNAL_DETAILS) {
      expect(text).not.toContain(detail);
    }
  });

  test('tidak menulis kredensial database ke log saat readiness gagal', async () => {
    const { app, logs } = buildTestApp({ probe: failingProbe, logLevel: 'debug' });

    await app.handle(getRequest('/ready'));

    expect(logs.length).toBeGreaterThan(0);

    for (const line of logs) {
      expect(line).not.toContain('rahasia-test');
      expect(line).not.toContain('svc_todo');
    }
  });

  test('requestId pada body 503 sama dengan header x-request-id', async () => {
    const { app } = buildTestApp({ probe: failingProbe });

    const response = await app.handle(getRequest('/ready', { 'x-request-id': 'trace-ready-1' }));
    const body = (await response.json()) as Record<string, Record<string, string>>;

    expect(response.headers.get('x-request-id')).toBe('trace-ready-1');
    expect(body.error?.requestId).toBe('trace-ready-1');
  });
});
