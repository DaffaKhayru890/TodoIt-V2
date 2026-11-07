import { describe, expect, test } from 'bun:test';
import { createApp } from '../../src/bootstrap/create-app';
import { buildTestAppConfig } from '../helpers/test-app-config';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { CheckServiceReadiness } from '../../src/modules/health/application/check-service-readiness';
import { connectedProbe } from '../helpers/test-app';
import { InMemoryAuthRepository } from '../helpers/in-memory-auth-repository';
import { InMemoryWorkspaceRepository } from '../helpers/in-memory-workspace-repository';
import { BunPasswordHasher } from '../../src/modules/auth/infrastructure/security/bun-password-hasher';
import { JoseAccessTokenService } from '../../src/modules/auth/infrastructure/security/jose-access-token.service';
import { CryptoRefreshTokenGenerator } from '../../src/modules/auth/infrastructure/security/crypto-refresh-token.generator';
import { systemClock } from '../../src/modules/auth/application/ports/clock';
import { RegisterUser } from '../../src/modules/auth/application/use-cases/register-user';
import { LoginUser } from '../../src/modules/auth/application/use-cases/login-user';
import { RefreshSession } from '../../src/modules/auth/application/use-cases/refresh-session';
import { LogoutUser } from '../../src/modules/auth/application/use-cases/logout-user';
import { GetCurrentUser } from '../../src/modules/auth/application/use-cases/get-current-user';
import { CreateWorkspace } from '../../src/modules/workspace/application/use-cases/create-workspace';
import { ListWorkspaces } from '../../src/modules/workspace/application/use-cases/list-workspaces';
import { GetWorkspace } from '../../src/modules/workspace/application/use-cases/get-workspace';
import { UpdateWorkspace } from '../../src/modules/workspace/application/use-cases/update-workspace';
import { ArchiveWorkspace } from '../../src/modules/workspace/application/use-cases/archive-workspace';

function buildFullTestApp() {
  const config = buildTestAppConfig();
  const logger = createLogger('silent');
  const readiness = new CheckServiceReadiness(connectedProbe);

  const authRepo = new InMemoryAuthRepository();
  const workspaceRepo = new InMemoryWorkspaceRepository();

  const passwordHasher = new BunPasswordHasher();
  const accessTokenService = new JoseAccessTokenService({
    secret: config.auth.jwtSecret,
    issuer: config.auth.jwtIssuer,
    audience: config.auth.jwtAudience,
    ttlSeconds: config.auth.accessTokenTtlSeconds,
    clock: systemClock
  });
  const refreshTokenGenerator = new CryptoRefreshTokenGenerator();
  const tokenLifetimePolicy = {
    accessTokenTtlSeconds: config.auth.accessTokenTtlSeconds,
    refreshTokenTtlSeconds: config.auth.refreshTokenTtlSeconds
  };
  const securityLog = { warn: () => {} };

  const registerUser = new RegisterUser(authRepo, passwordHasher, systemClock);
  const loginUser = new LoginUser(
    authRepo,
    authRepo,
    passwordHasher,
    accessTokenService,
    refreshTokenGenerator,
    tokenLifetimePolicy,
    systemClock
  );
  const refreshSession = new RefreshSession(
    authRepo,
    accessTokenService,
    refreshTokenGenerator,
    tokenLifetimePolicy,
    systemClock,
    securityLog
  );
  const logoutUser = new LogoutUser(authRepo, refreshTokenGenerator, systemClock);
  const getCurrentUser = new GetCurrentUser(authRepo, authRepo, accessTokenService, systemClock);

  const createWorkspace = new CreateWorkspace(workspaceRepo, systemClock);
  const listWorkspaces = new ListWorkspaces(workspaceRepo);
  const getWorkspace = new GetWorkspace(workspaceRepo);
  const updateWorkspace = new UpdateWorkspace(workspaceRepo, systemClock);
  const archiveWorkspace = new ArchiveWorkspace(workspaceRepo, systemClock);

  return createApp({
    config,
    logger,
    readiness,
    auth: {
      config,
      registerUser,
      loginUser,
      refreshSession,
      logoutUser,
      getCurrentUser
    },
    workspace: {
      getCurrentUser,
      createWorkspace,
      listWorkspaces,
      getWorkspace,
      updateWorkspace,
      archiveWorkspace
    }
  });
}

describe('OpenAPI Phase 2 documentation', () => {
  test('seluruh endpoint Auth dan Workspace terdaftar di /openapi/json', async () => {
    const app = buildFullTestApp();

    const response = await app.handle(new Request('http://test.local/openapi/json'));
    expect(response.status).toBe(200);

    const spec = (await response.json()) as any;
    const paths = Object.keys(spec.paths);

    // Auth endpoints
    expect(paths).toContain('/api/v1/auth/register');
    expect(paths).toContain('/api/v1/auth/login');
    expect(paths).toContain('/api/v1/auth/refresh');
    expect(paths).toContain('/api/v1/auth/logout');
    expect(paths).toContain('/api/v1/auth/me');

    // Workspace endpoints
    expect(paths).toContain('/api/v1/workspaces');
    expect(paths).toContain('/api/v1/workspaces/{workspaceId}');
    expect(paths).toContain('/api/v1/workspaces/{workspaceId}/archive');

    // Security schemes
    expect(spec.components?.securitySchemes?.bearerAuth).toBeDefined();
    expect(spec.components?.securitySchemes?.cookieAuth).toBeDefined();
  });
});
