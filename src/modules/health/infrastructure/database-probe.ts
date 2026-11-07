import type { DatabaseClient } from '../../../shared/infrastructure/database/client';
import type { DatabaseProbe } from '../application/ports/database-probe';

/**
 * Adapter Infrastructure untuk contract DatabaseProbe. Satu-satunya tempat modul
 * health menyentuh driver PostgreSQL; query yang dipakai cukup `SELECT 1`.
 */
export function createDatabaseProbe(client: DatabaseClient): DatabaseProbe {
  return {
    probe: () => client.ping()
  };
}
