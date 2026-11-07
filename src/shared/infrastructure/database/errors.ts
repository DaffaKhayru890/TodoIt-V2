/**
 * Deteksi error constraint PostgreSQL tanpa mengekspos detail SQL ke layer
 * atas. Kode 23505 = unique_violation, 23503 = foreign_key_violation.
 */
interface PostgresErrorLike {
  readonly code?: unknown;
}

export function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as PostgresErrorLike).code === '23505'
  );
}

export function isForeignKeyViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as PostgresErrorLike).code === '23503'
  );
}
