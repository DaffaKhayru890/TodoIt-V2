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
import { DrizzleTodoRepository } from '../modules/todo/infrastructure/persistence/drizzle-todo.repository';
import { Base64UrlCursorCodec } from '../modules/todo/infrastructure/pagination/cursor-encoder';
import { TodoAccessService } from '../modules/todo/application/services/todo-access.service';
import { TodoDateRangeService } from '../modules/todo/application/services/todo-date-range.service';
import { TodoListingService } from '../modules/todo/application/services/todo-listing.service';
import type { WorkspaceAccessPort } from '../modules/todo/application/ports/workspace-access';
import { CreateTodo } from '../modules/todo/application/use-cases/create-todo';
import { ListTodos } from '../modules/todo/application/use-cases/list-todos';
import { GetTodo } from '../modules/todo/application/use-cases/get-todo';
import { UpdateTodo } from '../modules/todo/application/use-cases/update-todo';
import { DeleteTodo } from '../modules/todo/application/use-cases/delete-todo';
import { CompleteTodo } from '../modules/todo/application/use-cases/complete-todo';
import { ListTodayTodos } from '../modules/todo/application/use-cases/list-today-todos';
import { ListUpcomingTodos } from '../modules/todo/application/use-cases/list-upcoming-todos';
import { ListOverdueTodos } from '../modules/todo/application/use-cases/list-overdue-todos';
import { DrizzleTagRepository } from '../modules/todo/infrastructure/persistence/drizzle-tag.repository';
import { DrizzleLabelRepository } from '../modules/todo/infrastructure/persistence/drizzle-label.repository';
import { DrizzleReminderRepository } from '../modules/todo/infrastructure/persistence/drizzle-reminder.repository';
import { DrizzleTodoUnitOfWork } from '../modules/todo/infrastructure/persistence/drizzle-todo-unit-of-work';
import { Base64UrlReminderCursorCodec } from '../modules/todo/infrastructure/pagination/reminder-cursor-encoder';
import { TodoMetadataService } from '../modules/todo/application/services/todo-metadata.service';
import { CreateTag } from '../modules/todo/application/use-cases/tag/create-tag';
import { ListTags } from '../modules/todo/application/use-cases/tag/list-tags';
import { GetTag } from '../modules/todo/application/use-cases/tag/get-tag';
import { UpdateTag } from '../modules/todo/application/use-cases/tag/update-tag';
import { DeleteTag } from '../modules/todo/application/use-cases/tag/delete-tag';
import { ReplaceTodoTags } from '../modules/todo/application/use-cases/tag/replace-todo-tags';
import { AddTodoTag } from '../modules/todo/application/use-cases/tag/add-todo-tag';
import { RemoveTodoTag } from '../modules/todo/application/use-cases/tag/remove-todo-tag';
import { CreateLabel } from '../modules/todo/application/use-cases/label/create-label';
import { ListLabels } from '../modules/todo/application/use-cases/label/list-labels';
import { GetLabel } from '../modules/todo/application/use-cases/label/get-label';
import { UpdateLabel } from '../modules/todo/application/use-cases/label/update-label';
import { DeleteLabel } from '../modules/todo/application/use-cases/label/delete-label';
import { AssignTodoLabel } from '../modules/todo/application/use-cases/label/assign-todo-label';
import { ClearTodoLabel } from '../modules/todo/application/use-cases/label/clear-todo-label';
import { CreateReminder } from '../modules/todo/application/use-cases/reminder/create-reminder';
import { ListTodoReminders } from '../modules/todo/application/use-cases/reminder/list-todo-reminders';
import { GetReminder } from '../modules/todo/application/use-cases/reminder/get-reminder';
import { UpdateReminder } from '../modules/todo/application/use-cases/reminder/update-reminder';
import { CancelReminder } from '../modules/todo/application/use-cases/reminder/cancel-reminder';
import type { TodoRoutesDependencies } from '../modules/todo/presentation/http/todo.routes';

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
  readonly todo: TodoRoutesDependencies;
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

  // Todo module: authorization memakai membership workspace yang sudah ada,
  // diadaptasi ke port milik Todo agar application layer tetap independen.
  const todoWorkspaceAccess: WorkspaceAccessPort = {
    findMembership: async (workspaceId, userId) => {
      const found = await workspaceRepository.findWorkspaceWithRole(workspaceId, userId);

      if (!found) {
        return null;
      }

      return {
        role: found.role,
        workspaceArchivedAt: found.workspace.archivedAt
      };
    }
  };

  const todoRepository = new DrizzleTodoRepository(database.db);
  const tagRepository = new DrizzleTagRepository(database.db);
  const labelRepository = new DrizzleLabelRepository(database.db);
  const reminderRepository = new DrizzleReminderRepository(database.db);
  const todoUnitOfWork = new DrizzleTodoUnitOfWork(database.db);
  const todoCursorCodec = new Base64UrlCursorCodec();
  const reminderCursorCodec = new Base64UrlReminderCursorCodec();
  const todoAccess = new TodoAccessService(todoWorkspaceAccess);
  const todoDateRange = new TodoDateRangeService(systemClock, config.defaultTimezone);
  const todoMetadata = new TodoMetadataService(labelRepository, tagRepository);
  const todoListing = new TodoListingService(
    todoRepository,
    todoAccess,
    todoCursorCodec,
    todoMetadata
  );
  const updateTodo = new UpdateTodo(todoAccess, todoUnitOfWork, todoMetadata, systemClock);

  const todoDeps: TodoRoutesDependencies = {
    getCurrentUser,
    createTodo: new CreateTodo(todoRepository, todoAccess, systemClock),
    listTodos: new ListTodos(todoListing),
    getTodo: new GetTodo(todoRepository, todoAccess, todoMetadata),
    updateTodo,
    deleteTodo: new DeleteTodo(todoAccess, todoUnitOfWork, systemClock),
    completeTodo: new CompleteTodo(todoAccess, todoUnitOfWork, todoMetadata, systemClock),
    listTodayTodos: new ListTodayTodos(todoListing, todoDateRange),
    listUpcomingTodos: new ListUpcomingTodos(todoListing, todoDateRange),
    listOverdueTodos: new ListOverdueTodos(todoListing, todoDateRange),
    createTag: new CreateTag(tagRepository, todoAccess, systemClock),
    listTags: new ListTags(tagRepository, todoAccess, todoCursorCodec),
    getTag: new GetTag(tagRepository, todoAccess),
    updateTag: new UpdateTag(tagRepository, todoAccess, systemClock),
    deleteTag: new DeleteTag(tagRepository, todoAccess),
    replaceTodoTags: new ReplaceTodoTags(todoAccess, todoUnitOfWork, systemClock),
    addTodoTag: new AddTodoTag(todoAccess, todoUnitOfWork, systemClock),
    removeTodoTag: new RemoveTodoTag(todoAccess, todoUnitOfWork),
    createLabel: new CreateLabel(labelRepository, todoAccess, systemClock),
    listLabels: new ListLabels(labelRepository, todoAccess, todoCursorCodec),
    getLabel: new GetLabel(labelRepository, todoAccess),
    updateLabel: new UpdateLabel(labelRepository, todoAccess, systemClock),
    deleteLabel: new DeleteLabel(labelRepository, todoAccess),
    assignTodoLabel: new AssignTodoLabel(updateTodo),
    clearTodoLabel: new ClearTodoLabel(updateTodo),
    createReminder: new CreateReminder(todoAccess, todoUnitOfWork, systemClock),
    listTodoReminders: new ListTodoReminders(
      todoRepository,
      reminderRepository,
      todoAccess,
      reminderCursorCodec
    ),
    getReminder: new GetReminder(todoRepository, reminderRepository, todoAccess),
    updateReminder: new UpdateReminder(todoAccess, todoUnitOfWork, systemClock),
    cancelReminder: new CancelReminder(
      todoRepository,
      reminderRepository,
      todoAccess,
      systemClock
    )
  };

  return {
    config,
    logger,
    database,
    readiness,
    auth: authDeps,
    workspace: workspaceDeps,
    todo: todoDeps,
    close: () => database.close()
  };
}
