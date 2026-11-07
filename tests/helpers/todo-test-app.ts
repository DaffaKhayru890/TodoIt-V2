import { createApp } from '../../src/bootstrap/create-app';
import type { AppConfig } from '../../src/config/app-config';
import { CheckServiceReadiness } from '../../src/modules/health/application/check-service-readiness';
import { createLogger } from '../../src/shared/infrastructure/logging/logger';
import { FixedClock } from '../../src/shared/domain/clock';
import { InMemoryAuthRepository } from './in-memory-auth-repository';
import { InMemoryWorkspaceRepository } from './in-memory-workspace-repository';
import { InMemoryTodoRepository } from './in-memory-todo-repository';
import { InMemoryTagRepository } from './in-memory-tag-repository';
import { InMemoryLabelRepository } from './in-memory-label-repository';
import { InMemoryReminderRepository } from './in-memory-reminder-repository';
import { InMemoryTodoUnitOfWork } from './in-memory-todo-unit-of-work';
import { buildTestAppConfig } from './test-app-config';
import { connectedProbe } from './test-app';
import { JoseAccessTokenService } from '../../src/modules/auth/infrastructure/security/jose-access-token.service';
import { GetCurrentUser } from '../../src/modules/auth/application/use-cases/get-current-user';
import { toEmail } from '../../src/modules/auth/domain/value-objects/email';
import { Base64UrlCursorCodec } from '../../src/modules/todo/infrastructure/pagination/cursor-encoder';
import { Base64UrlReminderCursorCodec } from '../../src/modules/todo/infrastructure/pagination/reminder-cursor-encoder';
import { TodoAccessService } from '../../src/modules/todo/application/services/todo-access.service';
import { TodoDateRangeService } from '../../src/modules/todo/application/services/todo-date-range.service';
import { TodoListingService } from '../../src/modules/todo/application/services/todo-listing.service';
import { TodoMetadataService } from '../../src/modules/todo/application/services/todo-metadata.service';
import { CreateTodo } from '../../src/modules/todo/application/use-cases/create-todo';
import { ListTodos } from '../../src/modules/todo/application/use-cases/list-todos';
import { GetTodo } from '../../src/modules/todo/application/use-cases/get-todo';
import { UpdateTodo } from '../../src/modules/todo/application/use-cases/update-todo';
import { DeleteTodo } from '../../src/modules/todo/application/use-cases/delete-todo';
import { CompleteTodo } from '../../src/modules/todo/application/use-cases/complete-todo';
import { ListTodayTodos } from '../../src/modules/todo/application/use-cases/list-today-todos';
import { ListUpcomingTodos } from '../../src/modules/todo/application/use-cases/list-upcoming-todos';
import { ListOverdueTodos } from '../../src/modules/todo/application/use-cases/list-overdue-todos';
import { CreateTag } from '../../src/modules/todo/application/use-cases/tag/create-tag';
import { ListTags } from '../../src/modules/todo/application/use-cases/tag/list-tags';
import { GetTag } from '../../src/modules/todo/application/use-cases/tag/get-tag';
import { UpdateTag } from '../../src/modules/todo/application/use-cases/tag/update-tag';
import { DeleteTag } from '../../src/modules/todo/application/use-cases/tag/delete-tag';
import { ReplaceTodoTags } from '../../src/modules/todo/application/use-cases/tag/replace-todo-tags';
import { AddTodoTag } from '../../src/modules/todo/application/use-cases/tag/add-todo-tag';
import { RemoveTodoTag } from '../../src/modules/todo/application/use-cases/tag/remove-todo-tag';
import { CreateLabel } from '../../src/modules/todo/application/use-cases/label/create-label';
import { ListLabels } from '../../src/modules/todo/application/use-cases/label/list-labels';
import { GetLabel } from '../../src/modules/todo/application/use-cases/label/get-label';
import { UpdateLabel } from '../../src/modules/todo/application/use-cases/label/update-label';
import { DeleteLabel } from '../../src/modules/todo/application/use-cases/label/delete-label';
import { AssignTodoLabel } from '../../src/modules/todo/application/use-cases/label/assign-todo-label';
import { ClearTodoLabel } from '../../src/modules/todo/application/use-cases/label/clear-todo-label';
import { CreateReminder } from '../../src/modules/todo/application/use-cases/reminder/create-reminder';
import { ListTodoReminders } from '../../src/modules/todo/application/use-cases/reminder/list-todo-reminders';
import { GetReminder } from '../../src/modules/todo/application/use-cases/reminder/get-reminder';
import { UpdateReminder } from '../../src/modules/todo/application/use-cases/reminder/update-reminder';
import { CancelReminder } from '../../src/modules/todo/application/use-cases/reminder/cancel-reminder';
import type { Workspace } from '../../src/modules/workspace/domain/entities/workspace';
import { WorkspaceRole } from '../../src/modules/workspace/domain/enums/workspace-role';

export const TEST_NOW = new Date('2026-11-07T10:00:00.000Z');

export interface TodoTestAppOptions {
  readonly clock?: FixedClock;
  readonly config?: Partial<AppConfig>;
  readonly defaultTimezone?: string;
}

export interface TodoTestApp {
  readonly app: ReturnType<typeof createApp>;
  readonly config: AppConfig;
  readonly authRepo: InMemoryAuthRepository;
  readonly workspaceRepo: InMemoryWorkspaceRepository;
  readonly todoRepo: InMemoryTodoRepository;
  readonly tagRepo: InMemoryTagRepository;
  readonly labelRepo: InMemoryLabelRepository;
  readonly reminderRepo: InMemoryReminderRepository;
  readonly accessTokenService: JoseAccessTokenService;
  readonly clock: FixedClock;
}

/**
 * Merakit aplikasi lengkap untuk Todo endpoint test. Auth/workspace routes tidak
 * dipasang karena test Phase 3 berfokus pada todo; auth guard tetap memakai
 * GetCurrentUser yang sesungguhnya sehingga verifikasi JWT ikut diuji.
 */
export function createTodoTestApp(options: TodoTestAppOptions = {}): TodoTestApp {
  const config = buildTestAppConfig({
    ...options.config,
    ...(options.defaultTimezone !== undefined ? { defaultTimezone: options.defaultTimezone } : {})
  });
  const logger = createLogger('silent');
  const readiness = new CheckServiceReadiness(connectedProbe);
  const clock = options.clock ?? new FixedClock(TEST_NOW);

  const authRepo = new InMemoryAuthRepository();
  const workspaceRepo = new InMemoryWorkspaceRepository();
  const todoRepo = new InMemoryTodoRepository();
  const tagRepo = new InMemoryTagRepository(todoRepo);
  const labelRepo = new InMemoryLabelRepository(todoRepo);
  const reminderRepo = new InMemoryReminderRepository();
  const unitOfWork = new InMemoryTodoUnitOfWork(
    todoRepo,
    tagRepo,
    labelRepo,
    reminderRepo
  );

  const accessTokenService = new JoseAccessTokenService({
    secret: config.auth.jwtSecret,
    issuer: config.auth.jwtIssuer,
    audience: config.auth.jwtAudience,
    ttlSeconds: config.auth.accessTokenTtlSeconds,
    clock
  });

  const getCurrentUser = new GetCurrentUser(authRepo, authRepo, accessTokenService, clock);

  const todoWorkspaceAccess = {
    findMembership: async (workspaceId: string, userId: string) => {
      const found = await workspaceRepo.findWorkspaceWithRole(workspaceId, userId);

      if (!found) {
        return null;
      }

      return {
        role: found.role,
        workspaceArchivedAt: found.workspace.archivedAt
      };
    }
  };

  const cursorCodec = new Base64UrlCursorCodec();
  const reminderCursorCodec = new Base64UrlReminderCursorCodec();
  const access = new TodoAccessService(todoWorkspaceAccess);
  const dates = new TodoDateRangeService(clock, config.defaultTimezone);
  const metadata = new TodoMetadataService(labelRepo, tagRepo);
  const listing = new TodoListingService(todoRepo, access, cursorCodec, metadata);
  const updateTodo = new UpdateTodo(access, unitOfWork, metadata, clock);

  const app = createApp({
    config,
    logger,
    readiness,
    todo: {
      getCurrentUser,
      createTodo: new CreateTodo(todoRepo, access, clock),
      listTodos: new ListTodos(listing),
      getTodo: new GetTodo(todoRepo, access, metadata),
      updateTodo,
      deleteTodo: new DeleteTodo(access, unitOfWork, clock),
      completeTodo: new CompleteTodo(access, unitOfWork, metadata, clock),
      listTodayTodos: new ListTodayTodos(listing, dates),
      listUpcomingTodos: new ListUpcomingTodos(listing, dates),
      listOverdueTodos: new ListOverdueTodos(listing, dates),
      createTag: new CreateTag(tagRepo, access, clock),
      listTags: new ListTags(tagRepo, access, cursorCodec),
      getTag: new GetTag(tagRepo, access),
      updateTag: new UpdateTag(tagRepo, access, clock),
      deleteTag: new DeleteTag(tagRepo, access),
      replaceTodoTags: new ReplaceTodoTags(access, unitOfWork, clock),
      addTodoTag: new AddTodoTag(access, unitOfWork, clock),
      removeTodoTag: new RemoveTodoTag(access, unitOfWork),
      createLabel: new CreateLabel(labelRepo, access, clock),
      listLabels: new ListLabels(labelRepo, access, cursorCodec),
      getLabel: new GetLabel(labelRepo, access),
      updateLabel: new UpdateLabel(labelRepo, access, clock),
      deleteLabel: new DeleteLabel(labelRepo, access),
      assignTodoLabel: new AssignTodoLabel(updateTodo),
      clearTodoLabel: new ClearTodoLabel(updateTodo),
      createReminder: new CreateReminder(access, unitOfWork, clock),
      listTodoReminders: new ListTodoReminders(
        todoRepo,
        reminderRepo,
        access,
        reminderCursorCodec
      ),
      getReminder: new GetReminder(todoRepo, reminderRepo, access),
      updateReminder: new UpdateReminder(access, unitOfWork, clock),
      cancelReminder: new CancelReminder(todoRepo, reminderRepo, access, clock)
    }
  });

  return {
    app,
    config,
    authRepo,
    workspaceRepo,
    todoRepo,
    tagRepo,
    labelRepo,
    reminderRepo,
    accessTokenService,
    clock
  };
}

export async function createAuthenticatedUser(
  authRepo: InMemoryAuthRepository,
  accessTokenService: JoseAccessTokenService,
  email: string,
  now: Date = TEST_NOW
): Promise<{ userId: string; token: string }> {
  const user = await authRepo.createNewUser({
    email: toEmail(email),
    displayName: 'Todo User',
    passwordHash: 'hash',
    now
  });

  const { session } = await authRepo.startSession({
    userId: user.id,
    hash: `hash_${user.id}`,
    sessionExpiresAt: new Date(now.getTime() + 86_400_000),
    tokenExpiresAt: new Date(now.getTime() + 86_400_000),
    userAgent: null,
    now
  });

  const { token } = await accessTokenService.generate({
    userId: user.id,
    sessionId: session.id
  });

  return { userId: user.id, token };
}

export async function createWorkspaceForUser(
  workspaceRepo: InMemoryWorkspaceRepository,
  userId: string,
  name = 'Todo Workspace',
  now: Date = TEST_NOW
): Promise<Workspace> {
  const { workspace } = await workspaceRepo.createWorkspaceWithMembership({
    name,
    description: null,
    createdBy: userId,
    now
  });

  return workspace;
}

export function addWorkspaceMember(
  workspaceRepo: InMemoryWorkspaceRepository,
  workspaceId: string,
  userId: string,
  role: WorkspaceRole = WorkspaceRole.MEMBER,
  now: Date = TEST_NOW
): void {
  workspaceRepo.members.push({
    id: crypto.randomUUID(),
    workspaceId,
    userId,
    role,
    joinedAt: now
  });
}

export function authHeader(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

export function jsonHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}
