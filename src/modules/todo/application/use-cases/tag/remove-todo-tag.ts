import { TodoError } from '../../../domain/errors/todo-error';
import { toTagSummaryDto, type TagSummaryDto } from '../../dto/tag.dto';
import { TodoAction } from '../../policies/todo-access.policy';
import type { TodoUnitOfWork } from '../../ports/todo-unit-of-work';
import type { TodoAccessService } from '../../services/todo-access.service';

export interface RemoveTodoTagInput {
  readonly workspaceId: string;
  readonly userId: string;
  readonly todoId: string;
  readonly tagId: string;
}

export class RemoveTodoTag {
  constructor(
    private readonly access: TodoAccessService,
    private readonly uow: TodoUnitOfWork
  ) {}

  async execute(input: RemoveTodoTagInput): Promise<{ tags: TagSummaryDto[] }> {
    await this.access.assertAccess(input.workspaceId, input.userId, TodoAction.UPDATE);

    return await this.uow.run(async (tx) => {
      const todo = await tx.lockActiveTodo(input.workspaceId, input.todoId);

      if (!todo) {
        throw TodoError.notFound();
      }

      const tag = await tx.tags.findById(input.workspaceId, input.tagId);

      if (!tag) {
        throw TodoError.tagNotFound();
      }

      // Idempoten: association yang memang tidak ada tetap dianggap sukses.
      await tx.tags.removeTodoTag(input.todoId, input.tagId);

      const tags = await tx.tags.findByTodoIds([input.todoId]);

      return { tags: (tags.get(input.todoId) ?? []).map(toTagSummaryDto) };
    });
  }
}
