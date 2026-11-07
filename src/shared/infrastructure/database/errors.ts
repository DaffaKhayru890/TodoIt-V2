/**
 * Deteksi error constraint PostgreSQL tanpa mengekspos detail SQL ke layer
 * atas. Kode 23505 = unique_violation, 23503 = foreign_key_violation.
 */
interface PostgresErrorLike {
  readonly code?: unknown;
  readonly constraint?: unknown;
}

function postgresError(error: unknown): PostgresErrorLike | null {
  let current: unknown = error;

  for (let depth = 0; depth < 5 && typeof current === 'object' && current !== null; depth += 1) {
    const candidate = current as PostgresErrorLike & { cause?: unknown };

    if (candidate.code === '23505' || candidate.code === '23503') {
      return candidate;
    }

    current = candidate.cause;
  }

  return null;
}

export function isUniqueViolation(error: unknown): boolean {
  return postgresError(error)?.code === '23505';
}

export function uniqueConstraintName(error: unknown): string | null {
  const constraint = postgresError(error)?.constraint;

  return typeof constraint === 'string' ? constraint : null;
}

export function isForeignKeyViolation(error: unknown): boolean {
  return postgresError(error)?.code === '23503';
}
