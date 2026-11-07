import { Elysia } from 'elysia';
import type { CheckServiceReadiness } from '../modules/health/application/check-service-readiness';
import { createHealthRoutes } from '../modules/health/presentation/http/health.routes';
import {
  createAuthRoutes,
  type AuthRoutesDependencies
} from '../modules/auth/presentation/http/auth.routes';
import {
  createWorkspaceRoutes,
  type WorkspaceRoutesDependencies
} from '../modules/workspace/presentation/http/workspace.routes';

export interface ModuleDependencies {
  readonly readiness: CheckServiceReadiness;
  readonly auth?: AuthRoutesDependencies | undefined;
  readonly workspace?: WorkspaceRoutesDependencies | undefined;
}

/**
 * Titik pemasangan module bisnis. Penambahan modul baru hanya mengubah fungsi
 * ini, tidak menyentuh create-app maupun main.
 *
 * Endpoint health/readiness berada di root karena dipergunakan probe orchestrator.
 * Endpoint bisnis berada di bawah `/api/v1`.
 */
export function registerModules(deps: ModuleDependencies) {
  const app = new Elysia().use(createHealthRoutes({ readiness: deps.readiness }));

  if (deps.auth && deps.workspace) {
    return app
      .use(createAuthRoutes(deps.auth))
      .use(createWorkspaceRoutes(deps.workspace));
  }

  if (deps.auth) {
    return app.use(createAuthRoutes(deps.auth));
  }

  if (deps.workspace) {
    return app.use(createWorkspaceRoutes(deps.workspace));
  }

  return app;
}
