import type { AppConfig } from '../config/app-config';
import { CheckServiceReadiness } from '../modules/health/application/check-service-readiness';
import { createDatabaseProbe } from '../modules/health/infrastructure/database-probe';
import { createDatabaseClient, type DatabaseClient } from '../shared/infrastructure/database/client';
import { createLogger, type Logger } from '../shared/infrastructure/logging/logger';
import { DrizzleAuthRepository } from '../modules/auth/infrastructure/persistence/drizzle-auth.repository';
import { DrizzleWorkspaceRepository } from '../modules/workspace/infrastructure/persistence/drizzle-workspace.repository';
import { BunPasswordHasher } from '../modules/auth/infrastructure/security/bun-password-hasher';
import { JoseAccessTokenService } from '../modules/auth/infrastructure/security/jose-access-token.service';
import { CryptoRefreshTokenGenerator } from '../modules/auth/infrastructure/security/crypto-refresh-token.generator';
import { systemClock } from '../modules/auth/application/ports/clock';
import type { SecurityLog } from '../modules/auth/application/ports/security-log';
import { RegisterUser } from '../modules/auth/application/use-cases/register-user';
import { LoginUser } from '../modules/auth/application/use-cases/login-user';
import { RefreshSession } from '../modules/auth/application/use-cases/refresh-session';
import { LogoutUser } from '../modules/auth/application/use-cases/logout-user';
import { GetCurrentUser } from '../modules/auth/application/use-cases/get-current-user';
import { CreateWorkspace } from '../modules/workspace/application/use-cases/create-workspace';
import { ListWorkspaces } from '../modules/workspace/application/use-cases/list-workspaces';
import { GetWorkspace } from '../modules/workspace/application/use-cases/get-workspace';
import { UpdateWorkspace } from '../modules/workspace/application/use-cases/update-workspace';
import { ArchiveWorkspace } from '../modules/workspace/application/use-cases/archive-workspace';
import type { AuthRoutesDependencies } from '../modules/auth/presentation/http/auth.routes';
import type { WorkspaceRoutesDependencies } from '../modules/workspace/presentation/http/workspace.routes';

/**
 * Composition Root. Seluruh implementasi konkret dipertemukan di sini; layer
 * dalam (Application/Domain) hanya menerima abstraction. Tidak ada global
 * mutable state: container dibuat sekali di main.ts dan diteruskan lewat argumen.
 */
export interface ApplicationContainer {
  readonly config: AppConfig;
  readonly logger: Logger;
  readonly database: DatabaseClient;
  readonly readiness: CheckServiceReadiness;
  readonly auth: AuthRoutesDependencies;
  readonly workspace: WorkspaceRoutesDependencies;
  /** Melepas seluruh resource teknis (connection pool). */
  close(): Promise<void>;
}

export function createApplicationContainer(config: AppConfig): ApplicationContainer {
  const logger = createLogger(config.logLevel);
  const database = createDatabaseClient(config.database, logger.child({ component: 'database' }));
  const readiness = new CheckServiceReadiness(createDatabaseProbe(database));

  // Infrastructure repositories
  const authRepository = new DrizzleAuthRepository(database);
  const workspaceRepository = new DrizzleWorkspaceRepository(database);

  // Security services
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
  const securityLog: SecurityLog = {
    warn: (event, context) => logger.child({ component: 'security' }).warn(event, context)
  };

  // Auth use cases
  const registerUser = new RegisterUser(authRepository, passwordHasher, systemClock);
  const loginUser = new LoginUser(
    authRepository,
    authRepository,
    passwordHasher,
    accessTokenService,
    refreshTokenGenerator,
    tokenLifetimePolicy,
    systemClock
  );
  const refreshSession = new RefreshSession(
    authRepository,
    accessTokenService,
    refreshTokenGenerator,
    tokenLifetimePolicy,
    systemClock,
    securityLog
  );
  const logoutUser = new LogoutUser(authRepository, refreshTokenGenerator, systemClock);
  const getCurrentUser = new GetCurrentUser(authRepository, authRepository, accessTokenService, systemClock);

  // Workspace use cases
  const createWorkspace = new CreateWorkspace(workspaceRepository, systemClock);
  const listWorkspaces = new ListWorkspaces(workspaceRepository);
  const getWorkspace = new GetWorkspace(workspaceRepository);
  const updateWorkspace = new UpdateWorkspace(workspaceRepository, systemClock);
  const archiveWorkspace = new ArchiveWorkspace(workspaceRepository, systemClock);

  const authDeps: AuthRoutesDependencies = {
    config,
    registerUser,
    loginUser,
    refreshSession,
    logoutUser,
    getCurrentUser
  };

  const workspaceDeps: WorkspaceRoutesDependencies = {
    getCurrentUser,
    createWorkspace,
    listWorkspaces,
    getWorkspace,
    updateWorkspace,
    archiveWorkspace
  };

  return {
    config,
    logger,
    database,
    readiness,
    auth: authDeps,
    workspace: workspaceDeps,
    close: () => database.close()
  };
}
