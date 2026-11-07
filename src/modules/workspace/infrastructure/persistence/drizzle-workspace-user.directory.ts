import { eq, inArray } from 'drizzle-orm';
import type { DatabaseExecutor } from '../../../../shared/infrastructure/database/client';
import { users } from '../../../auth/infrastructure/persistence/auth.schema';
import type {
  WorkspaceUserDirectory,
  WorkspaceUserProfile
} from '../../application/ports/workspace-user-directory';

export class DrizzleWorkspaceUserDirectory implements WorkspaceUserDirectory {
  constructor(private readonly database: DatabaseExecutor) {}

  async findByNormalizedEmail(normalizedEmail: string): Promise<WorkspaceUserProfile | null> {
    const rows = await this.database
      .select({ id: users.id, email: users.email, displayName: users.displayName })
      .from(users)
      .where(eq(users.email, normalizedEmail))
      .limit(1);
    const row = rows[0];

    return row ?? null;
  }

  async findByIds(userIds: readonly string[]): Promise<readonly WorkspaceUserProfile[]> {
    if (userIds.length === 0) {
      return [];
    }

    return await this.database
      .select({ id: users.id, email: users.email, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, [...userIds]));
  }
}
