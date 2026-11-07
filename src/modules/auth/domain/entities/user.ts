import type { Email } from '../value-objects/email';

/**
 * Entitas User berdiri sendiri: ia tidak memuat informasi workspace dan tidak
 * mengenal tabel Drizzle. `passwordHash` hanya dipakai di dalam modul auth dan
 * tidak pernah keluar sebagai response.
 */
export interface User {
  readonly id: string;
  readonly email: Email;
  readonly displayName: string;
  readonly passwordHash: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}
