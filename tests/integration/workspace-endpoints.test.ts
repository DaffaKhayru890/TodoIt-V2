import { describe, expect, test } from 'bun:test';
import { createApp } from '../../src/bootstrap/create-app';
import { buildTestAppConfig } from '../helpers/test-app-config';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { CheckServiceReadiness } from '../../src/modules/health/application/check-service-readiness';
import { connectedProbe } from '../helpers/test-app';
import { InMemoryAuthRepository } from '../helpers/in-memory-auth-repository';
import { InMemoryWorkspaceRepository } from '../helpers/in-memory-workspace-repository';
import { JoseAccessTokenService } from '../../src/modules/auth/infrastructure/security/jose-access-token.service';
import { systemClock } from '../../src/modules/auth/application/ports/clock';
import { GetCurrentUser } from '../../src/modules/auth/application/use-cases/get-current-user';
import { CreateWorkspace } from '../../src/modules/workspace/application/use-cases/create-workspace';
import { ListWorkspaces } from '../../src/modules/workspace/application/use-cases/list-workspaces';
import { GetWorkspace } from '../../src/modules/workspace/application/use-cases/get-workspace';
import { UpdateWorkspace } from '../../src/modules/workspace/application/use-cases/update-workspace';
import { ArchiveWorkspace } from '../../src/modules/workspace/application/use-cases/archive-workspace';
import { toEmail } from '../../src/modules/auth/domain/value-objects/email';

function createWorkspaceTestApp() {
  const config = buildTestAppConfig();
  const logger = createLogger('silent');
  const readiness = new CheckServiceReadiness(connectedProbe);

  const authRepo = new InMemoryAuthRepository();
  const workspaceRepo = new InMemoryWorkspaceRepository();

  const accessTokenService = new JoseAccessTokenService({
    secret: config.auth.jwtSecret,
    issuer: config.auth.jwtIssuer,
    audience: config.auth.jwtAudience,
    ttlSeconds: config.auth.accessTokenTtlSeconds,
    clock: systemClock
  });

  const getCurrentUser = new GetCurrentUser(authRepo, authRepo, accessTokenService, systemClock);
  const createWorkspace = new CreateWorkspace(workspaceRepo, systemClock);
  const listWorkspaces = new ListWorkspaces(workspaceRepo);
  const getWorkspace = new GetWorkspace(workspaceRepo);
  const updateWorkspace = new UpdateWorkspace(workspaceRepo, systemClock);
  const archiveWorkspace = new ArchiveWorkspace(workspaceRepo, systemClock);

  const app = createApp({
    config,
    logger,
    readiness,
    workspace: {
      getCurrentUser,
      createWorkspace,
      listWorkspaces,
      getWorkspace,
      updateWorkspace,
      archiveWorkspace
    }
  });

  return { app, authRepo, accessTokenService };
}

async function createAuthenticatedUser(
  authRepo: InMemoryAuthRepository,
  accessTokenService: JoseAccessTokenService,
  emailStr: string
) {
  const now = new Date();
  const user = await authRepo.createNewUser({
    email: toEmail(emailStr),
    displayName: 'User',
    passwordHash: 'hash',
    now
  });

  const { session } = await authRepo.startSession({
    userId: user.id,
    hash: `hash_${user.id}`,
    sessionExpiresAt: new Date(now.getTime() + 100000),
    tokenExpiresAt: new Date(now.getTime() + 100000),
    userAgent: null,
    now
  });

  const { token } = await accessTokenService.generate({
    userId: user.id,
    sessionId: session.id
  });

  return { user, token };
}

describe('Workspace Endpoints HTTP Integration', () => {
  test('endpoint workspace menolak request tanpa token -> 401', async () => {
    const { app } = createWorkspaceTestApp();

    const res = await app.handle(new Request('http://test.local/api/v1/workspaces'));
    expect(res.status).toBe(401);
  });

  test('alur lengkap workspace: create -> list -> get -> patch -> archive -> list', async () => {
    const { app, authRepo, accessTokenService } = createWorkspaceTestApp();
    const { token: token1 } = await createAuthenticatedUser(
      authRepo,
      accessTokenService,
      'user1@example.com'
    );
    const { token: token2 } = await createAuthenticatedUser(
      authRepo,
      accessTokenService,
      'user2@example.com'
    );

    // 1. Create Workspace oleh User 1
    const createRes = await app.handle(
      new Request('http://test.local/api/v1/workspaces', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`
        },
        body: JSON.stringify({
          name: 'Project Delta',
          description: 'Delta description'
        })
      })
    );

    expect(createRes.status).toBe(201);
    const createBody = (await createRes.json()) as any;
    expect(createBody.workspace.id).toBeString();
    expect(createBody.workspace.name).toBe('Project Delta');
    expect(createBody.workspace.role).toBe('owner');

    const workspaceId = createBody.workspace.id;

    // 2. List Workspace untuk User 1
    const listRes1 = await app.handle(
      new Request('http://test.local/api/v1/workspaces', {
        headers: { Authorization: `Bearer ${token1}` }
      })
    );
    expect(listRes1.status).toBe(200);
    const listBody1 = (await listRes1.json()) as any;
    expect(listBody1.items.length).toBe(1);
    expect(listBody1.items[0].id).toBe(workspaceId);
    expect(listBody1.pagination.total).toBe(1);

    // 3. User 2 mencoba list (harus kosong)
    const listRes2 = await app.handle(
      new Request('http://test.local/api/v1/workspaces', {
        headers: { Authorization: `Bearer ${token2}` }
      })
    );
    expect(listRes2.status).toBe(200);
    const listBody2 = (await listRes2.json()) as any;
    expect(listBody2.items.length).toBe(0);
    expect(listBody2.pagination.total).toBe(0);

    // 4. User 2 mencoba akses detail workspace User 1 -> 404 WORKSPACE_ACCESS_DENIED
    const getResStranger = await app.handle(
      new Request(`http://test.local/api/v1/workspaces/${workspaceId}`, {
        headers: { Authorization: `Bearer ${token2}` }
      })
    );
    expect(getResStranger.status).toBe(404);

    // 5. User 1 get detail -> 200
    const getResOwner = await app.handle(
      new Request(`http://test.local/api/v1/workspaces/${workspaceId}`, {
        headers: { Authorization: `Bearer ${token1}` }
      })
    );
    expect(getResOwner.status).toBe(200);
    const getBodyOwner = (await getResOwner.json()) as any;
    expect(getBodyOwner.workspace.name).toBe('Project Delta');
    expect(getBodyOwner.workspace.role).toBe('owner');

    // 6. User 1 update workspace -> 200
    const patchRes = await app.handle(
      new Request(`http://test.local/api/v1/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token1}`
        },
        body: JSON.stringify({
          name: 'Project Delta Updated'
        })
      })
    );
    expect(patchRes.status).toBe(200);
    const patchBody = (await patchRes.json()) as any;
    expect(patchBody.workspace.name).toBe('Project Delta Updated');

    // 7. User 1 archive workspace -> 200
    const archiveRes = await app.handle(
      new Request(`http://test.local/api/v1/workspaces/${workspaceId}/archive`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token1}` }
      })
    );
    expect(archiveRes.status).toBe(200);
    const archiveBody = (await archiveRes.json()) as any;
    expect(archiveBody.workspace.id).toBe(workspaceId);
    expect(archiveBody.workspace.archivedAt).toBeDefined();

    // 8. Workspace yang sudah diarsipkan tidak muncul lagi di list
    const listResAfterArchive = await app.handle(
      new Request('http://test.local/api/v1/workspaces', {
        headers: { Authorization: `Bearer ${token1}` }
      })
    );
    expect(listResAfterArchive.status).toBe(200);
    const listBodyAfterArchive = (await listResAfterArchive.json()) as any;
    expect(listBodyAfterArchive.items.length).toBe(0);

    // 9. Get detail workspace yang diarsipkan -> 404
    const getResArchived = await app.handle(
      new Request(`http://test.local/api/v1/workspaces/${workspaceId}`, {
        headers: { Authorization: `Bearer ${token1}` }
      })
    );
    expect(getResArchived.status).toBe(404);
  });
});
