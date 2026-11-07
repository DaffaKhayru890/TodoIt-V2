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
import {
  createTodoRoutes,
  type TodoRoutesDependencies
} from '../modules/todo/presentation/http/todo.routes';

export interface ModuleDependencies {
  readonly readiness: CheckServiceReadiness;
  readonly auth?: AuthRoutesDependencies | undefined;
  readonly workspace?: WorkspaceRoutesDependencies | undefined;
  readonly todo?: TodoRoutesDependencies | undefined;
}

/**
 * Titik pemasangan module bisnis. Penambahan modul baru hanya mengubah fungsi
 * ini, tidak menyentuh create-app maupun main.
 *
 * Endpoint health/readiness berada di root karena dipergunakan probe orchestrator.
 * Endpoint bisnis berada di bawah `/api/v1`.
 */
export function registerModules(deps: ModuleDependencies) {
  type AnyElysia = Elysia<any, any, any, any, any, any, any>;

  let app: AnyElysia = new Elysia().use(createHealthRoutes({ readiness: deps.readiness }));

  if (deps.auth) {
    app = app.use(createAuthRoutes(deps.auth));
  }

  if (deps.workspace) {
    app = app.use(createWorkspaceRoutes(deps.workspace));
  }

  if (deps.todo) {
    app = app.use(createTodoRoutes(deps.todo));
  }

  return app;
}
