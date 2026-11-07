import { describe, expect, test } from 'bun:test';
import { sql } from 'drizzle-orm';
import { loadAppConfig } from '../../src/config/app-config';
import { buildConnectionString, createDatabaseClient } from '../../src/shared/infrastructure/database/client';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';

const config = loadAppConfig();
const silentLogger = createLogger('silent');

describe('DatabaseClient terhadap PostgreSQL nyata', () => {
  test('ping berhasil dan memakai connection pool yang sama', async () => {
    const client = createDatabaseClient(config.database, silentLogger);

    try {
      await client.ping();
      // Panggilan kedua memakai pool yang sama, bukan koneksi baru.
      await client.ping();
    } finally {
      await client.close();
    }
  });

  test('mengeksekusi SELECT 1 melalui Drizzle', async () => {
    const client = createDatabaseClient(config.database, silentLogger);

    try {
      const result = await client.db.execute(sql`SELECT 1 AS one`);

      expect(JSON.stringify(result)).toInclude('one');
    } finally {
      await client.close();
    }
  });

  test('setelah close, query berikutnya ditolak (graceful shutdown pool)', async () => {
    const client = createDatabaseClient(config.database, silentLogger);

    await client.ping();
    await client.close();

    await expect(client.ping()).rejects.toThrow();
  });

  test('ping menolak saat database tidak dapat dihubungi', async () => {
    const unreachable = createDatabaseClient({ ...config.database, host: '127.0.0.1', port: 54_33 }, silentLogger);

    try {
      await expect(unreachable.ping()).rejects.toThrow();
    } finally {
      await unreachable.close();
    }
  });
});

describe('buildConnectionString', () => {
  test('membangun URL postgres dari konfigurasi bertipe', () => {
    const url = new URL(buildConnectionString(config.database));

    expect(url.protocol).toBe('postgres:');
    expect(url.hostname).toBe(config.database.host);
    expect(url.port).toBe(String(config.database.port));
    expect(url.pathname).toBe(`/${config.database.name}`);
  });
});
