import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { loadAppConfig } from '../../src/config/app-config';
import { createApp } from '../../src/bootstrap/create-app';
import { CheckServiceReadiness } from '../../src/modules/health/application/check-service-readiness';
import { createDatabaseProbe } from '../../src/modules/health/infrastructure/database-probe';
import { createDatabaseClient } from '../../src/shared/infrastructure/database/client';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { ERROR_CODES } from '../../src/shared/presentation/http/errors/error-response';
import { getRequest } from '../helpers/test-app';

const config = loadAppConfig();
const logger = createLogger('silent');

describe('GET /ready dengan PostgreSQL nyata', () => {
  const client = createDatabaseClient(config.database, logger);
  const app = createApp({ config, logger, readiness: new CheckServiceReadiness(createDatabaseProbe(client)) });

  beforeAll(async () => {
    await client.ping();
  });

  afterAll(async () => {
    await client.close();
  });

  test('mengembalikan 200 ready saat database benar-benar terhubung', async () => {
    const response = await app.handle(getRequest('/ready'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ready', dependencies: { database: 'connected' } });
  });

  test('pool yang sama dipakai untuk request berikutnya', async () => {
    const first = await app.handle(getRequest('/ready'));
    const second = await app.handle(getRequest('/ready'));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
  });
});

describe('GET /ready saat database mati', () => {
  const unreachableConfig = { ...config.database, host: '127.0.0.1', port: 54_33 };
  const client = createDatabaseClient(unreachableConfig, logger);
  const app = createApp({
    config,
    logger,
    readiness: new CheckServiceReadiness(createDatabaseProbe(client), 2_000)
  });

  afterAll(async () => {
    await client.close();
  });

  test('mengembalikan 503 dengan sampul error SERVICE_UNAVAILABLE', async () => {
    const response = await app.handle(getRequest('/ready'));
    const body = (await response.json()) as { error: { code: string; requestId: string } };

    expect(response.status).toBe(503);
    expect(body.error.code).toBe(ERROR_CODES.SERVICE_UNAVAILABLE);
    expect(body.error.requestId).toBeString();
  });

  test('tidak membocorkan host, port, user, maupun nama database', async () => {
    const response = await app.handle(getRequest('/ready'));
    const text = await response.text();

    expect(text).not.toInclude('127.0.0.1');
    expect(text).not.toInclude('5433');
    expect(text).not.toInclude(config.database.user);
    expect(text).not.toInclude(config.database.name);
    expect(text).not.toInclude(config.database.password);
  });
});
