import { sql } from 'drizzle-orm';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import type { DatabaseConfig } from '../../../config/app-config';
import type { Logger } from '../logging/logger';
import { schema } from './schema';

const POOL_MAX_CONNECTIONS = 10;
const POOL_IDLE_TIMEOUT_MS = 30_000;
const POOL_CONNECTION_TIMEOUT_MS = 5_000;

/** Instance Drizzle bertipe penuh: repository memperoleh tabel dari schema gabungan. */
export type Database = NodePgDatabase<typeof schema>;

/**
 * Bagian dari instance Drizzle yang dibutuhkan repository. Tipe ini juga
 * dipenuhi oleh objek transaksi Drizzle, sehingga repository yang sama dapat
 * dipakai di luar maupun di dalam transaksi tanpa membocorkan tipe transaksi ke
 * application layer.
 */
export type DatabaseExecutor = Pick<
  Database,
  'select' | 'insert' | 'update' | 'delete' | 'execute'
>;

/**
 * Koneksi database dipakai bersama sepanjang umur proses: request berikutnya
 * mengambil koneksi dari pool yang sama, tidak membuat koneksi baru.
 */
export interface DatabaseClient {
  /** Menyelesaikan `SELECT 1`; menolak (reject) bila database tidak dapat diakses. */
  ping(): Promise<void>;
  /** Instance Drizzle untuk repository module. */
  readonly db: Database;
  /** Menutup seluruh koneksi pool secara rapi (graceful shutdown). */
  close(): Promise<void>;
}

export function buildConnectionString(config: DatabaseConfig): string {
  const credentials = encodeURIComponent(config.user);
  const secret = encodeURIComponent(config.password);

  return `postgres://${credentials}:${secret}@${config.host}:${config.port}/${config.name}${
    config.ssl ? '?ssl=true' : ''
  }`;
}

export function createDatabaseClient(config: DatabaseConfig, logger: Logger): DatabaseClient {
  const pool = new Pool({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.name,
    ssl: config.ssl ? { rejectUnauthorized: true } : undefined,
    max: POOL_MAX_CONNECTIONS,
    idleTimeoutMillis: POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: POOL_CONNECTION_TIMEOUT_MS
  });

  // pg memancarkan error pada pool bila koneksi idle putus; tanpa handler ini
  // proses crash padahal request berikutnya masih bisa dilayani.
  pool.on('error', (poolError) => {
    logger.error('idle database client error', { errorName: poolError.name });
  });

  const db = drizzle(pool, { schema });

  return {
    db,
    async ping(): Promise<void> {
      await db.execute(sql`SELECT 1`);
    },
    async close(): Promise<void> {
      await pool.end();
    }
  };
}
