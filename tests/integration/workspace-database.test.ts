import { describe, expect, test } from 'bun:test';
import { loadAppConfig } from '../../src/config/app-config';
import { createDatabaseClient } from '../../src/shared/infrastructure/database/client';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { DrizzleAuthRepository } from '../../src/modules/auth/infrastructure/persistence/drizzle-auth.repository';
import { DrizzleWorkspaceRepository } from '../../src/modules/workspace/infrastructure/persistence/drizzle-workspace.repository';
import { toEmail } from '../../src/modules/auth/domain/value-objects/email';
import { WorkspaceRole } from '../../src/modules/workspace/domain/enums/workspace-role';

const config = loadAppConfig();
const silentLogger = createLogger('silent');

describe('DrizzleWorkspaceRepository terhadap PostgreSQL nyata', () => {
  test('pembuatan workspace dan membership secara atomik', async () => {
    const client = createDatabaseClient(config.database, silentLogger);
    const authRepo = new DrizzleAuthRepository(client);
    const workspaceRepo = new DrizzleWorkspaceRepository(client);

    const now = new Date();
    try {
      const user = await authRepo.createNewUser({
        email: toEmail(`ws_user_${Date.now()}@example.com`),
        displayName: 'WS User',
        passwordHash: 'hash',
        now
      });

      const { workspace, membership } = await workspaceRepo.createWorkspaceWithMembership({
        name: 'Database Workspace',
        description: 'Postgres transactional workspace',
        createdBy: user.id,
        now
      });

      expect(workspace.id).toBeString();
      expect(workspace.name).toBe('Database Workspace');
      expect(membership.workspaceId).toBe(workspace.id);
      expect(membership.userId).toBe(user.id);
      expect(membership.role).toBe(WorkspaceRole.OWNER);

      // Verifikasi relasi join findWorkspaceWithRole
      const found = await workspaceRepo.findWorkspaceWithRole(workspace.id, user.id);
      expect(found).not.toBeNull();
      expect(found?.workspace.id).toBe(workspace.id);
      expect(found?.role).toBe(WorkspaceRole.OWNER);

      // Verifikasi listing
      const list = await workspaceRepo.listWorkspacesByUser({
        userId: user.id,
        limit: 10,
        offset: 0
      });

      expect(list.items.length).toBe(1);
      expect(list.total).toBe(1);
      expect(list.items[0]?.workspace.id).toBe(workspace.id);

      // Update
      const updated = await workspaceRepo.updateWorkspace({
        id: workspace.id,
        name: 'Database Workspace Updated',
        now: new Date()
      });
      expect(updated.name).toBe('Database Workspace Updated');

      // Archive
      const archived = await workspaceRepo.archiveWorkspace({
        id: workspace.id,
        now: new Date()
      });
      expect(archived.archivedAt).not.toBeNull();

      // Listing setelah archive harus kosong
      const listAfterArchive = await workspaceRepo.listWorkspacesByUser({
        userId: user.id,
        limit: 10,
        offset: 0
      });
      expect(listAfterArchive.items.length).toBe(0);
      expect(listAfterArchive.total).toBe(0);
    } finally {
      await client.close();
    }
  });
});
