import { FixedClock } from '../../src/shared/domain/clock';
import { InMemoryWorkspaceRepository } from './in-memory-workspace-repository';
import { InMemoryTodoRepository } from './in-memory-todo-repository';
import { InMemoryTagRepository } from './in-memory-tag-repository';
import { InMemoryLabelRepository } from './in-memory-label-repository';
import { InMemoryReminderRepository } from './in-memory-reminder-repository';
import { InMemoryTodoUnitOfWork } from './in-memory-todo-unit-of-work';
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
import { TodoPriority } from '../../src/modules/todo/domain/enums/todo-priority';
import type { TodoDto } from '../../src/modules/todo/application/dto/todo.dto';

export interface TodoFixture {
  readonly clock: FixedClock;
  readonly workspaceRepo: InMemoryWorkspaceRepository;
  readonly todoRepo: InMemoryTodoRepository;
  readonly tagRepo: InMemoryTagRepository;
  readonly labelRepo: InMemoryLabelRepository;
  readonly reminderRepo: InMemoryReminderRepository;
  readonly unitOfWork: InMemoryTodoUnitOfWork;
  readonly cursorCodec: Base64UrlCursorCodec;
  readonly reminderCursorCodec: Base64UrlReminderCursorCodec;
  readonly workspaceId: string;
  readonly userId: string;
  readonly otherUserId: string;
  readonly otherWorkspaceId: string;
  readonly createTodo: CreateTodo;
  readonly listTodos: ListTodos;
  readonly getTodo: GetTodo;
  readonly updateTodo: UpdateTodo;
  readonly deleteTodo: DeleteTodo;
  readonly completeTodo: CompleteTodo;
  readonly listTodayTodos: ListTodayTodos;
  readonly listUpcomingTodos: ListUpcomingTodos;
  readonly listOverdueTodos: ListOverdueTodos;
  readonly createTag: CreateTag;
  readonly listTags: ListTags;
  readonly getTag: GetTag;
  readonly updateTag: UpdateTag;
  readonly deleteTag: DeleteTag;
  readonly replaceTodoTags: ReplaceTodoTags;
  readonly addTodoTag: AddTodoTag;
  readonly removeTodoTag: RemoveTodoTag;
  readonly createLabel: CreateLabel;
  readonly listLabels: ListLabels;
  readonly getLabel: GetLabel;
  readonly updateLabel: UpdateLabel;
  readonly deleteLabel: DeleteLabel;
  readonly assignTodoLabel: AssignTodoLabel;
  readonly clearTodoLabel: ClearTodoLabel;
  readonly createReminder: CreateReminder;
  readonly listTodoReminders: ListTodoReminders;
  readonly getReminder: GetReminder;
  readonly updateReminder: UpdateReminder;
  readonly cancelReminder: CancelReminder;
  seed(overrides?: Partial<SeedTodoOverrides>): Promise<TodoDto>;
}

export interface SeedTodoOverrides {
  readonly title: string;
  readonly description: string | null;
  readonly priority: string;
  readonly dueAt: Date | null;
  readonly workspaceId: string;
  readonly userId: string;
}

export interface CreateTodoFixtureOptions {
  readonly now?: Date;
  readonly defaultTimezone?: string;
}

export async function createTodoFixture(
  options: CreateTodoFixtureOptions = {}
): Promise<TodoFixture> {
  const clock = new FixedClock(options.now ?? new Date('2026-11-07T10:00:00.000Z'));
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
  const cursorCodec = new Base64UrlCursorCodec();
  const reminderCursorCodec = new Base64UrlReminderCursorCodec();

  const userId = crypto.randomUUID();
  const otherUserId = crypto.randomUUID();

  const { workspace } = await workspaceRepo.createWorkspaceWithMembership({
    name: 'Primary Workspace',
    description: null,
    createdBy: userId,
    now: clock.now()
  });

  const { workspace: otherWorkspace } = await workspaceRepo.createWorkspaceWithMembership({
    name: 'Other Workspace',
    description: null,
    createdBy: otherUserId,
    now: clock.now()
  });

  const access = new TodoAccessService({
    findMembership: async (workspaceId, memberUserId) => {
      const found = await workspaceRepo.findWorkspaceWithRole(workspaceId, memberUserId);

      if (!found) {
        return null;
      }

      return {
        role: found.role,
        workspaceArchivedAt: found.workspace.archivedAt
      };
    }
  });

  const dates = new TodoDateRangeService(clock, options.defaultTimezone ?? 'UTC');
  const metadata = new TodoMetadataService(labelRepo, tagRepo);
  const listing = new TodoListingService(todoRepo, access, cursorCodec, metadata);

  const createTodo = new CreateTodo(todoRepo, access, clock);
  const listTodos = new ListTodos(listing);
  const updateTodo = new UpdateTodo(access, unitOfWork, metadata, clock);

  const fixture: TodoFixture = {
    clock,
    workspaceRepo,
    todoRepo,
    tagRepo,
    labelRepo,
    reminderRepo,
    unitOfWork,
    cursorCodec,
    reminderCursorCodec,
    workspaceId: workspace.id,
    userId,
    otherUserId,
    otherWorkspaceId: otherWorkspace.id,
    createTodo,
    listTodos,
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
    cancelReminder: new CancelReminder(todoRepo, reminderRepo, access, clock),
    async seed(overrides = {}) {
      return await createTodo.execute({
        workspaceId: overrides.workspaceId ?? workspace.id,
        userId: overrides.userId ?? userId,
        title: overrides.title ?? `Todo ${crypto.randomUUID().slice(0, 8)}`,
        description: overrides.description ?? null,
        priority: overrides.priority ?? TodoPriority.LOW,
        dueAt: overrides.dueAt ?? null
      });
    }
  };

  return fixture;
}
