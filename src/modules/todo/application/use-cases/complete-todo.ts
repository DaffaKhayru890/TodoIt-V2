import type { Clock } from '../../../../shared/domain/clock';
import { TodoError } from '../../domain/errors/todo-error';
import { toTodoDto, type TodoDto } from '../dto/todo.dto';
import { TodoAction } from '../policies/todo-access.policy';
import type { TodoMetadataService } from '../services/todo-metadata.service';
import type { TodoAccessService } from '../services/todo-access.service';
import type { TodoUnitOfWork } from '../ports/todo-unit-of-work';

export interface CompleteTodoInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
}

export class CompleteTodo {
  constructor(
    private readonly access: TodoAccessService,
    private readonly uow: TodoUnitOfWork,
    private readonly metadata: TodoMetadataService,
    private readonly clock: Clock
  ) {}

  async execute(input: CompleteTodoInput): Promise<TodoDto> {
    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.COMPLETE);

    const persisted = await this.uow.run(async (tx) => {
      const existing = await tx.lockActiveTodo(input.workspaceId, input.todoId);

      if (!existing) {
        throw TodoError.notFound();
      }

      const now = this.clock.now();
      const completed = existing.complete(now);

      // Sudah completed: tidak ada perubahan, jadi completedAt/updatedAt tetap
      // dan reminder scheduled (bila ada) tetap dibatalkan secara defensif.
      if (completed === existing) {
        await tx.reminders.cancelScheduledByTodoId(input.todoId, now);
        return existing;
      }

      const result = await tx.todos.update(completed);

      if (!result) {
        throw TodoError.notFound();
      }

      await tx.reminders.cancelScheduledByTodoId(input.todoId, now);

      return result;
    });

    const relations = await this.metadata.loadOne(input.workspaceId, persisted);

    return toTodoDto(persisted, relations);
  }
}
