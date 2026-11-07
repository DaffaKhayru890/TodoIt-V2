import { describe, expect, test } from 'bun:test';
import { t } from 'elysia';
import { ERROR_CODES, type ErrorResponseBody } from '../../src/shared/presentation/http/errors/error-response';
import { buildTestApp, getRequest } from '../helpers/test-app';

/**
 * Route tambahan khusus test dipakai untuk memaksa pipeline error bersama
 * bekerja (validasi body, JSON rusak, handler yang melempar error). Route ini
 * tidak ada di aplikasi sebenarnya.
 */
function buildAppWithTestRoutes() {
  const { app, logs } = buildTestApp({ logLevel: 'debug' });

  const instrumented = app
    .post(
      '/__test/validation',
      () => ({ accepted: true }),
      { body: t.Object({ name: t.String({ minLength: 3 }) }) }
    )
    .get('/__test/boom', () => {
      throw new Error('koneksi ke db.internal.test:5432 gagal');
    });

  return { instrumented, logs };
}

function postRaw(path: string, body: string): Request {
  return new Request(`http://test.local${path}`, {
    method: 'POST',
    body,
    headers: { 'content-type': 'application/json' }
  });
}

async function readErrorBody(response: Response): Promise<ErrorResponseBody> {
  return JSON.parse(await response.text()) as ErrorResponseBody;
}

describe('HTTP error handling', () => {
  test('endpoint tidak dikenal mengembalikan 404 dengan sampul error standar', async () => {
    const { app } = buildTestApp();

    const response = await app.handle(getRequest('/tidak-ada'));
    const body = await readErrorBody(response);

    expect(response.status).toBe(404);
    expect(body.error.code).toBe(ERROR_CODES.NOT_FOUND);
    expect(body.error.requestId).toBeString();
    expect(response.headers.get('x-request-id')).toBe(body.error.requestId);
  });

  test('body tidak valid mengembalikan 422 dengan rincian field', async () => {
    const { instrumented } = buildAppWithTestRoutes();

    const response = await instrumented.handle(postRaw('/__test/validation', JSON.stringify({ name: 'ab' })));
    const body = await readErrorBody(response);

    expect(response.status).toBe(422);
    expect(body.error.code).toBe(ERROR_CODES.VALIDATION_ERROR);
    expect(body.error.details?.[0]?.path).toInclude('name');
  });

  test('JSON rusak ditangani sebagai 400 tanpa membocorkan detail parser', async () => {
    const { instrumented } = buildAppWithTestRoutes();

    const response = await instrumented.handle(postRaw('/__test/validation', '{bukan json'));
    const text = await response.text();
    const body = JSON.parse(text) as ErrorResponseBody;

    expect(response.status).toBe(400);
    expect(body.error.code).toBe(ERROR_CODES.BAD_REQUEST);
    expect(text).not.toInclude('Expected');
  });

  test('error yang tidak tertangani menjadi 500 generik tanpa stack trace', async () => {
    const { instrumented, logs } = buildAppWithTestRoutes();

    const response = await instrumented.handle(getRequest('/__test/boom'));
    const text = await response.text();
    const body = JSON.parse(text) as ErrorResponseBody;

    expect(response.status).toBe(500);
    expect(body.error.code).toBe(ERROR_CODES.INTERNAL_SERVER_ERROR);
    expect(body.error.message).toBe('An unexpected error occurred');

    // Detail teknis hanya boleh muncul di log server, tidak di respons.
    expect(text).not.toInclude('db.internal.test');
    expect(text).not.toInclude('stack');

    const failureLog = logs.find((line) => line.includes('request failed'));

    expect(failureLog).toBeString();
    expect(failureLog).not.toInclude('db.internal.test');
    expect(JSON.parse(failureLog ?? '{}').requestId).toBe(body.error.requestId);
  });
});

describe('CORS berdasarkan environment', () => {
  test('mencerminkan origin yang terdaftar di CORS_ORIGINS', async () => {
    const { app } = buildTestApp();

    const response = await app.handle(
      new Request('http://test.local/health', { headers: { origin: 'http://localhost:3000' } })
    );

    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:3000');
    expect(response.headers.get('access-control-expose-headers')).toInclude('x-request-id');
  });

  test('tidak memberikan izin untuk origin yang tidak terdaftar', async () => {
    const { app } = buildTestApp();

    const response = await app.handle(
      new Request('http://test.local/health', { headers: { origin: 'http://evill.example' } })
    );

    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('origin yang tidak dikonfigurasi membuat server tidak memancarkan header CORS', async () => {
    const { app } = buildTestApp({ config: { corsOrigins: [] } });

    const response = await app.handle(
      new Request('http://test.local/health', { headers: { origin: 'http://localhost:3000' } })
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });
});
