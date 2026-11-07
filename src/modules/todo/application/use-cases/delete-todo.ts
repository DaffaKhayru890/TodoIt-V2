import type { Clock } from '../../../../shared/domain/clock';
import { TodoAction } from '../policies/todo-access.policy';
import type { TodoAccessService } from '../services/todo-access.service';
import type { TodoUnitOfWork } from '../ports/todo-unit-of-work';

export interface DeleteTodoInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
}

export class DeleteTodo {
  constructor(
    private readonly access: TodoAccessService,
    private readonly uow: TodoUnitOfWork,
    private readonly clock: Clock
  ) {}

  /**
   * Idempoten: menghapus Todo yang sudah terhapus (atau tidak ada) tetap
   * menghasilkan sukses selama user adalah member workspace. Soft delete dan
   * pembatalan reminder scheduled berjalan dalam satu transaksi.
   */
  async execute(input: DeleteTodoInput): Promise<void> {
    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.DELETE);

    await this.uow.run(async (tx) => {
      const existing = await tx.lockActiveTodo(input.workspaceId, input.todoId);

      if (!existing) {
        return;
      }

      const now = this.clock.now();

      await tx.todos.softDelete({
        workspaceId: input.workspaceId,
        todoId: input.todoId,
        now
      });
      await tx.reminders.cancelScheduledByTodoId(input.todoId, now);
    });
  }
}
