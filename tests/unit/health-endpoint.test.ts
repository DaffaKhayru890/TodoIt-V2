import { describe, expect, test } from 'bun:test';
import { buildTestApp, failingProbe, getRequest } from '../helpers/test-app';

describe('GET /health', () => {
  test('mengembalikan HTTP 200 dengan schema { status: "ok" }', async () => {
    const { app } = buildTestApp();

    const response = await app.handle(getRequest('/health'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')?.startsWith('application/json')).toBe(true);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  test('tetap menjawab walau database gagal dihubung', async () => {
    // /health adalah liveness probe: ia sengaja tidak menyentuh database.
    const { app } = buildTestApp({ probe: failingProbe });

    const response = await app.handle(getRequest('/health'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  test('memancarkan x-request-id baru dan memakainya pada access log', async () => {
    const { app, logs } = buildTestApp({ logLevel: 'info' });

    const response = await app.handle(getRequest('/health'));
    const requestId = response.headers.get('x-request-id');

    expect(requestId).toMatch(/^[0-9a-f-]{36}$/);

    const accessLog = JSON.parse(logs.find((line) => line.includes('request handled')) ?? '{}');

    expect(accessLog.requestId).toBe(requestId);
    expect(accessLog.method).toBe('GET');
    expect(accessLog.path).toBe('/health');
    expect(accessLog.status).toBe(200);
  });

  test('memakai ulang x-request-id yang dikirim klien', async () => {
    const { app } = buildTestApp();

    const response = await app.handle(getRequest('/health', { 'x-request-id': 'trace-abc-123' }));

    expect(response.headers.get('x-request-id')).toBe('trace-abc-123');
  });

  test('mengabaikan nilai x-request-id tidak wajar dan membuat ID baru', async () => {
    const { app } = buildTestApp();
    const unsafe = '<script>console.log(1)</script>';

    const response = await app.handle(getRequest('/health', { 'x-request-id': unsafe }));

    expect(response.headers.get('x-request-id')).not.toBe(unsafe);
    expect(response.headers.get('x-request-id')).toMatch(/^[0-9a-f-]{36}$/);
  });
});
