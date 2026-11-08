import { http, HttpResponse } from 'msw';
import { describe, expect, test } from 'vitest';
import { createHttpClient } from '@/core/api/http-client';
import { ApiError } from '@/core/errors/api-error';
import { server } from '@/test/mocks/server';

describe('createHttpClient', () => {
  test('mengembalikan JSON ketika server menjawab sukses', async () => {
    server.use(http.get('http://api.test/health', () => HttpResponse.json({ status: 'ok' })));
    const client = createHttpClient({ baseUrl: 'http://api.test' });

    await expect(client.request('/health')).resolves.toEqual({ status: 'ok' });
  });

  test('menormalkan error API', async () => {
    server.use(
      http.get('http://api.test/me', () =>
        HttpResponse.json(
          { error: { code: 'UNAUTHORIZED', message: 'sesi tidak valid', requestId: 'req-1' } },
          { status: 401 }
        )
      )
    );
    const client = createHttpClient({ baseUrl: 'http://api.test' });

    await expect(client.request('/me')).rejects.toMatchObject({
      name: 'ApiError',
      status: 401,
      code: 'UNAUTHORIZED',
      message: 'sesi tidak valid'
    });
  });

  test('mempertahankan detail validasi dari backend', async () => {
    server.use(
      http.post('http://api.test/workspaces', () =>
        HttpResponse.json(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Permintaan tidak lolos validasi skema.',
              requestId: 'req-422',
              details: [{ path: 'body.name', message: 'Nama terlalu panjang.' }]
            }
          },
          { status: 422 }
        )
      )
    );
    const client = createHttpClient({ baseUrl: 'http://api.test' });

    await expect(client.request('/workspaces', { method: 'POST' })).rejects.toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      details: [{ path: 'body.name', message: 'Nama terlalu panjang.' }]
    });
  });

  test('mengubah kegagalan jaringan menjadi ApiError', async () => {
    server.use(http.get('http://api.test/down', () => HttpResponse.error()));
    const client = createHttpClient({ baseUrl: 'http://api.test' });

    await expect(client.request('/down')).rejects.toBeInstanceOf(ApiError);
    await expect(client.request('/down')).rejects.toMatchObject({
      status: 0,
      code: 'NETWORK_ERROR'
    });
  });

  test('menolak JSON yang tidak valid', async () => {
    server.use(
      http.get('http://api.test/bad', () => new HttpResponse('bukan-json', { status: 200 }))
    );
    const client = createHttpClient({ baseUrl: 'http://api.test' });

    await expect(client.request('/bad')).rejects.toMatchObject({ code: 'INVALID_JSON' });
  });

  test('menggabungkan base URL dan mengirim header serta body', async () => {
    let authorization = '';
    let body = '';

    server.use(
      http.post('http://api.test/items', async ({ request }) => {
        authorization = request.headers.get('authorization') ?? '';
        body = await request.text();
        return HttpResponse.json({ id: '1' }, { status: 201 });
      })
    );

    const client = createHttpClient({
      baseUrl: 'http://api.test/',
      getAccessToken: () => 'access-token'
    });

    await expect(
      client.request('/items', { method: 'POST', body: { name: 'Catatan' } })
    ).resolves.toEqual({
      id: '1'
    });
    expect(authorization).toBe('Bearer access-token');
    expect(body).toBe('{"name":"Catatan"}');
  });
});
